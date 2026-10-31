import { defaults } from "@/lib/config";
import { embedTexts } from "@/lib/embeddings";
import { embedLocal } from "@/lib/embeddings/local";

import { reciprocalRankFusion } from "./hybrid";
import { keywordSearch } from "./keyword";
import { rerank, type RerankResult } from "./rerank";
import {
  vectorSearch,
  type EmbeddingColumn,
  type RetrievedChunk,
  type SearchOptions,
} from "./vector";

export type { RetrievedChunk } from "./vector";

import type { Method } from "./methods";

export { METHODS, type Method } from "./methods";

export type RetrieveOptions = SearchOptions & {
  topK: number;
  model?: EmbeddingColumn;
  /** Rerank the hybrid candidates (or the chosen method's) with Cohere. */
  rerank?: boolean;
};

export type QueryEmbedding = {
  ms: number;
  cached: boolean;
  /** Gemini only; the local model costs nothing. */
  tokens: number;
};

async function embedQuery(query: string, model: EmbeddingColumn) {
  const t0 = performance.now();
  if (model === "local") {
    const [vector] = await embedLocal([query]);
    return { vector, info: { ms: ms(t0), cached: false, tokens: 0 } };
  }
  const result = await embedTexts([query], "RETRIEVAL_QUERY");
  return {
    vector: result.vectors[0],
    info: { ms: ms(t0), cached: result.cacheHits === 1, tokens: result.embeddedTokens },
  };
}

function ms(t0: number) {
  return Math.round(performance.now() - t0);
}

export type ArenaResult = {
  query: QueryEmbedding;
  vector: { chunks: RetrievedChunk[]; ms: number };
  keyword: { chunks: RetrievedChunk[]; ms: number };
  hybrid: { chunks: (RetrievedChunk & { ranks: (number | null)[] })[]; ms: number };
  rerank: ({ ms: number } & RerankResult) | { error: string } | null;
};

/**
 * All four methods for one query, for the retrieval arena. Vector and
 * keyword each fetch a wider candidate pool than topK, because hybrid can
 * only promote what one of them found and the reranker can only reorder
 * what hybrid hands it.
 */
export async function retrieveAll(query: string, options: RetrieveOptions): Promise<ArenaResult> {
  const pool = Math.max(options.topK, defaults.candidates);
  const model = options.model ?? "gemini";
  const embedded = await embedQuery(query, model);

  const timed = async <T>(fn: () => Promise<T>) => {
    const t0 = performance.now();
    const value = await fn();
    return { value, ms: ms(t0) };
  };
  const [vec, kw] = await Promise.all([
    timed(() => vectorSearch(embedded.vector, pool, { ...options, model })),
    timed(() => keywordSearch(query, pool, options)),
  ]);

  const t0 = performance.now();
  const fusedPool = reciprocalRankFusion([vec.value, kw.value], pool);
  const hybridMs = ms(t0);

  let reranked: ArenaResult["rerank"] = null;
  if (options.rerank) {
    const t1 = performance.now();
    try {
      reranked = { ...(await rerank(query, fusedPool, options.topK)), ms: ms(t1) };
    } catch (err) {
      reranked = { error: err instanceof Error ? err.message : String(err) };
    }
  }

  return {
    query: embedded.info,
    vector: { chunks: vec.value.slice(0, options.topK), ms: vec.ms },
    keyword: { chunks: kw.value.slice(0, options.topK), ms: kw.ms },
    hybrid: { chunks: fusedPool.slice(0, options.topK), ms: hybridMs },
    rerank: reranked,
  };
}

export type ChatRetrieval = {
  sources: RetrievedChunk[];
  /** What each source was ranked by, for run_chunks.method. */
  method: Method | "rerank";
  query: QueryEmbedding | null;
  searchMs: number;
  rerank: { cached: boolean; billedTokens: number; ms: number } | null;
};

/**
 * One method for chat. Keyword needs no embedding call at all; rerank
 * reorders a candidate pool from the chosen method.
 */
export async function retrieveForChat(
  query: string,
  method: Method,
  options: RetrieveOptions,
): Promise<ChatRetrieval> {
  const pool = options.rerank ? Math.max(options.topK, defaults.candidates) : options.topK;
  const model = options.model ?? "gemini";
  const embedded = method === "keyword" ? null : await embedQuery(query, model);

  const t0 = performance.now();
  let sources: RetrievedChunk[];
  if (method === "keyword") {
    sources = await keywordSearch(query, pool, options);
  } else if (method === "vector") {
    sources = await vectorSearch(embedded!.vector, pool, { ...options, model });
  } else {
    const [v, k] = await Promise.all([
      vectorSearch(embedded!.vector, pool, { ...options, model }),
      keywordSearch(query, pool, options),
    ]);
    sources = reciprocalRankFusion([v, k], pool);
  }
  const searchMs = ms(t0);

  if (!options.rerank) {
    return { sources, method, query: embedded?.info ?? null, searchMs, rerank: null };
  }
  const t1 = performance.now();
  const r = await rerank(query, sources, options.topK);
  return {
    sources: r.chunks,
    method: "rerank",
    query: embedded?.info ?? null,
    searchMs,
    rerank: { cached: r.cached, billedTokens: r.billedTokens, ms: ms(t1) },
  };
}
