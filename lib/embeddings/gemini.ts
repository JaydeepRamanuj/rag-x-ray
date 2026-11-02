import { embeddingModels } from "@/lib/config";
import { fetchWithRetry } from "@/lib/llm/retry";

const model = embeddingModels.gemini;
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${model.id}:batchEmbedContents`;

/**
 * The same model embeds documents and queries differently. A query is short
 * and phrased as a question; the passage that answers it is long and phrased
 * as a statement. Task types let the model map both into the same region.
 */
export type TaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" | "SEMANTIC_SIMILARITY";

/**
 * Scales a vector to length 1. gemini-embedding-001 only normalises its full
 * 3072-dim output; truncated vectors come back shorter than 1 (about 0.59
 * at 768 dims in practice). Cosine distance doesn't care, but inner-product
 * search and any "similarity = dot product" shortcut would silently be wrong.
 */
export function normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return norm === 0 ? vector : vector.map((v) => v / norm);
}

export function toBatchBody(texts: string[], taskType: TaskType) {
  return {
    requests: texts.map((text) => ({
      model: `models/${model.id}`,
      content: { parts: [{ text }] },
      // The docs mark these top-level fields deprecated in favour of
      // embedContentConfig, but on 2026-10-31 the API silently ignored
      // embedContentConfig (returning 3072 dims) and honoured these.
      taskType,
      outputDimensionality: model.dimensions,
    })),
  };
}

/** One batchEmbedContents call. Callers handle batching and caching. */
export async function embedBatchGemini(
  texts: string[],
  taskType: TaskType,
  signal?: AbortSignal,
): Promise<number[][]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const { response } = await fetchWithRetry(URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(toBatchBody(texts, taskType)),
    signal,
  });
  const json = (await response.json()) as { embeddings: { values: number[] }[] };
  if (json.embeddings?.length !== texts.length) {
    throw new Error(`Expected ${texts.length} embeddings, got ${json.embeddings?.length}`);
  }
  return json.embeddings.map((e) => normalize(e.values));
}
