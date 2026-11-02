import { getMany, increment, readCounter, setMany, sha256 } from "@/lib/cache";
import { rerankModel } from "@/lib/config";
import { fetchWithRetry } from "@/lib/llm/retry";

import type { RetrievedChunk } from "./vector";

export type RerankResult = {
  chunks: (RetrievedChunk & { previousRank: number })[];
  cached: boolean;
  /** Tokens Cohere billed (query + every document). 0 on a cache hit. */
  billedTokens: number;
  /** Calls made this calendar month, by this app's own count. */
  callsThisMonth: number | null;
};

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;

/**
 * The cache key is the query plus the exact candidate list, in order. The
 * candidates come from a particular chunk set, so this is "per query and
 * chunk set": re-chunking makes new chunk ids and so a new key.
 */
export function rerankCacheKey(query: string, chunkIds: string[]): string {
  return `rerank:${rerankModel.id}:${sha256(`${query}\n${chunkIds.join(",")}`)}`;
}

function monthKey(now = new Date()): string {
  return `rerank:calls:${now.toISOString().slice(0, 7)}`;
}

/**
 * Takes Cohere's `{ index, relevance_score }` list and maps it back onto the
 * candidates. Each chunk keeps the rank it had going in, so the arena can
 * show how far the reranker moved it.
 */
export function applyRerank(
  candidates: RetrievedChunk[],
  results: { index: number; relevance_score: number }[],
  topK: number,
): RerankResult["chunks"] {
  return results.slice(0, topK).map((r) => ({
    ...candidates[r.index],
    score: r.relevance_score,
    previousRank: r.index + 1,
  }));
}

/**
 * A cross-encoder reads the query and each candidate together and scores
 * how well the candidate answers it. That's far more accurate than
 * comparing two separately made vectors, and far too slow to run over a
 * whole corpus, so it only reorders the few candidates retrieval found.
 *
 * The trial key allows 10 calls a minute and 1,000 a month, so results are
 * cached in Upstash and every real call is counted.
 */
export async function rerank(
  query: string,
  candidates: RetrievedChunk[],
  topK: number,
): Promise<RerankResult> {
  if (candidates.length === 0) {
    return { chunks: [], cached: false, billedTokens: 0, callsThisMonth: null };
  }
  const key = rerankCacheKey(
    query,
    candidates.map((c) => c.chunkId),
  );
  const [hit] = await getMany([key]);
  if (hit) {
    // Upstash parses JSON-looking values on the way out, so this may already be an array.
    const results = typeof hit === "string" ? JSON.parse(hit) : hit;
    return {
      chunks: applyRerank(candidates, results, topK),
      cached: true,
      billedTokens: 0,
      callsThisMonth: await readCounter(monthKey()),
    };
  }

  const apiKey = process.env.COHERE_API_KEY;
  if (!apiKey) throw new Error("COHERE_API_KEY is not set, so reranking is unavailable.");

  const { response } = await fetchWithRetry("https://api.cohere.com/v2/rerank", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: rerankModel.id,
      query,
      documents: candidates.map((c) => c.content),
      // All of them: the cache then holds the full order, whatever topK asks for.
      top_n: candidates.length,
    }),
  });
  const body = (await response.json()) as {
    results: { index: number; relevance_score: number }[];
    meta?: { billed_units?: { input_tokens?: number } };
  };
  const callsThisMonth = await increment(monthKey(), 60 * 60 * 24 * 40);
  await setMany([[key, JSON.stringify(body.results)]], CACHE_TTL_SECONDS);

  return {
    chunks: applyRerank(candidates, body.results, topK),
    cached: false,
    billedTokens: body.meta?.billed_units?.input_tokens ?? 0,
    callsThisMonth,
  };
}
