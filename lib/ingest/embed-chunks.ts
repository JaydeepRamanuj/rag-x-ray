import { insertIngestUsage } from "@/lib/db/ledger";
import { embedTexts } from "@/lib/embeddings";
import { embedLocal } from "@/lib/embeddings/local";

/**
 * Gemini vectors for chunks being stored, with the usage logged to
 * ingest_usage so the ledger's daily chart counts it. Logged even when a
 * later step fails: the quota was spent either way.
 */
export async function embedChunksGemini(
  texts: string[],
  log: { documentId: string | null; title: string },
): Promise<number[][]> {
  const t0 = performance.now();
  const result = await embedTexts(texts, "RETRIEVAL_DOCUMENT");
  await insertIngestUsage({
    documentId: log.documentId,
    title: log.title,
    status: "ok",
    chunks: texts.length,
    cacheHits: result.cacheHits,
    embedTokens: result.embeddedTokens,
    requests: result.batches,
    totalMs: Math.round(performance.now() - t0),
  }).catch((err) => console.error("Failed to log embedding usage:", err));
  return result.vectors;
}

/**
 * Local vectors, or undefined where the model can't run (on Vercel, if the
 * ONNX runtime didn't fit). Storing a chunk without one only means the
 * arena's local option skips it until it's filled in.
 */
export async function embedChunksLocal(texts: string[]): Promise<number[][] | undefined> {
  try {
    return await embedLocal(texts);
  } catch (err) {
    console.warn("Local embeddings unavailable:", err instanceof Error ? err.message : err);
    return undefined;
  }
}
