import { connection } from "next/server";
import { z } from "zod";

import { checkPassword } from "@/lib/auth";
import { chunkText, DEFAULT_SEMANTIC_THRESHOLD, STRATEGIES } from "@/lib/chunking";
import { overlapTokens } from "@/lib/chunking/lab";
import { getDocumentText, insertChunkSet, listChunkSets } from "@/lib/db/chunk-sets";
import { embedLocalMemo } from "@/lib/embeddings/local";
import { embedChunksGemini, embedChunksLocal } from "@/lib/ingest/embed-chunks";

export const maxDuration = 300;

export async function GET(request: Request) {
  await connection();
  const documentId = new URL(request.url).searchParams.get("documentId") ?? undefined;
  if (documentId && !/^[0-9a-f-]{36}$/i.test(documentId)) {
    return Response.json({ error: "Bad documentId" }, { status: 400 });
  }
  return Response.json(
    { chunkSets: await listChunkSets(documentId) },
    { headers: { "cache-control": "no-store" } },
  );
}

const bodySchema = z.object({
  documentId: z.uuid(),
  strategy: z.enum(STRATEGIES),
  chunkSize: z.number().int().min(100).max(1_000),
  overlapPct: z.number().min(0).max(30),
  threshold: z.number().min(-1).max(1).default(DEFAULT_SEMANTIC_THRESHOLD),
});

/**
 * Saves one strategy as a new chunk set: chunk, embed with both models,
 * store. Gemini embeddings use the daily quota (cache hits don't), so this
 * sits behind the password like uploads do. The new set starts inactive.
 */
export async function POST(request: Request) {
  const auth = checkPassword(request);
  if (!auth.ok) return auth.response;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }
  const { documentId, strategy, chunkSize, overlapPct, threshold } = parsed.data;
  const doc = await getDocumentText(documentId);
  if (!doc) return Response.json({ error: "Document not found" }, { status: 404 });

  try {
    const settings = {
      strategy,
      chunkSize,
      overlap: overlapTokens(chunkSize, overlapPct),
      threshold,
    };
    const { chunks } = await chunkText(doc.rawText, settings, embedLocalMemo);
    const texts = chunks.map((c) => c.content);
    const [gemini, local] = await Promise.all([
      embedChunksGemini(texts, { documentId, title: `${doc.title} (${strategy} set)` }),
      embedChunksLocal(texts),
    ]);
    const id = await insertChunkSet({
      documentId,
      settings,
      chunks: chunks.map((c, i) => ({ ...c, embedding: gemini[i], embeddingLocal: local?.[i] })),
    });
    return Response.json({ id, chunks: chunks.length, local: Boolean(local) }, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
