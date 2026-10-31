import { checkPassword } from "@/lib/auth";
import { sha256 } from "@/lib/cache";
import { recursiveChunk } from "@/lib/chunking/recursive";
import { defaults, limits } from "@/lib/config";
import {
  deleteDocument,
  findDocumentByHash,
  insertDocumentWithChunks,
  totalTokens,
} from "@/lib/db/documents";
import { embedTexts } from "@/lib/embeddings";
import { extract, sourceTypeFor } from "@/lib/ingest/extract";
import type { IngestEventMap, IngestEventName } from "@/lib/ingest/events";
import { encodeSse, sseHeaders } from "@/lib/sse/encoder";
import { estimateTokens } from "@/lib/tokens/count";

// The Hobby plan's ceiling. Embedding waits on the per-minute token budget,
// so a large document can take a couple of minutes.
export const maxDuration = 300;

/**
 * One document per request, with progress streamed as SSE. Synchronous
 * ingestion keeps the app free of a job queue; the per-upload limits keep
 * it inside one function's time limit.
 */
export async function POST(request: Request) {
  const auth = checkPassword(request);
  if (!auth.ok) return auth.response;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Attach a file in the 'file' field." }, { status: 400 });
  }
  if (!sourceTypeFor(file.name)) {
    return Response.json(
      { error: "Only .pdf, .md and .txt files are supported." },
      { status: 415 },
    );
  }
  if (file.size > limits.maxUploadBytes) {
    return Response.json(
      { error: `Files over ${limits.maxUploadBytes / 1024 / 1024} MB aren't accepted.` },
      { status: 413 },
    );
  }

  const t0 = performance.now();
  const since = () => Math.round(performance.now() - t0);
  const bytes = new Uint8Array(await file.arrayBuffer());

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = <K extends IngestEventName>(event: K, data: IngestEventMap[K]) => {
        try {
          controller.enqueue(encodeSse(event, data));
        } catch {
          // client left; ingestion carries on so the work isn't wasted
        }
      };

      try {
        const { sourceType, text, pages } = await extract(file.name, bytes);
        if (!text) throw new Error("No text found. Scanned PDFs need OCR, which isn't supported.");
        if (pages && pages > limits.maxPagesPerUpload) {
          throw new Error(`${pages} pages; the limit is ${limits.maxPagesPerUpload} per upload.`);
        }
        const tokens = estimateTokens(text);
        send("extracted", { atMs: since(), sourceType, pages, chars: text.length, tokens });

        const hash = sha256(text);
        const existing = await findDocumentByHash(hash);
        const otherTokens = (await totalTokens()) - (existing?.tokenCount ?? 0);
        if (otherTokens + tokens > limits.maxTotalTokens) {
          throw new Error(
            `This would bring the library to ${(otherTokens + tokens).toLocaleString()} tokens; the cap is ${limits.maxTotalTokens.toLocaleString()}. Delete a document first.`,
          );
        }

        const chunks = recursiveChunk(text, {
          chunkSize: defaults.chunkSize,
          overlap: defaults.chunkOverlap,
        });
        const sizes = chunks.map((c) => c.tokenCount);
        send("chunked", {
          atMs: since(),
          chunks: chunks.length,
          avgTokens: Math.round(sizes.reduce((s, n) => s + n, 0) / Math.max(1, sizes.length)),
          minTokens: Math.min(...sizes),
          maxTokens: Math.max(...sizes),
        });

        const embedded = await embedTexts(
          chunks.map((c) => c.content),
          "RETRIEVAL_DOCUMENT",
          (p) => send("embedding", { atMs: since(), ...p, total: chunks.length }),
        );

        // Replace only after the new copy is fully embedded, so a failed
        // re-upload never leaves you with neither version.
        if (existing) {
          send("replacing", { atMs: since(), documentId: existing.id, title: existing.title });
          await deleteDocument(existing.id);
        }

        const { documentId } = await insertDocumentWithChunks({
          title: file.name,
          sourceType,
          rawText: text,
          tokenCount: tokens,
          contentHash: hash,
          pageCount: pages,
          strategy: "recursive",
          chunkSize: defaults.chunkSize,
          overlap: defaults.chunkOverlap,
          chunks: chunks.map((c, i) => ({ ordinal: i, ...c, embedding: embedded.vectors[i] })),
        });
        send("stored", { atMs: since(), documentId });
        send("done", {
          atMs: since(),
          documentId,
          title: file.name,
          chunks: chunks.length,
          cacheHits: embedded.cacheHits,
          embeddedTokens: embedded.embeddedTokens,
          batches: embedded.batches,
        });
      } catch (err) {
        send("error", { atMs: since(), message: err instanceof Error ? err.message : String(err) });
      }
      controller.close();
    },
  });

  return new Response(stream, { headers: sseHeaders });
}
