import { decodeVector, encodeVector, getMany, setMany, sha256 } from "@/lib/cache";
import { embeddingModels, limits } from "@/lib/config";
import { sleep } from "@/lib/llm/retry";
import { estimateTokens } from "@/lib/tokens/count";

import { embedBatchGemini, type TaskType } from "./gemini";

export type { TaskType } from "./gemini";

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;

/**
 * The cache key covers everything that changes the vector: model, size,
 * task type and the exact text. Change any one and it's a different entry,
 * so a stale vector can never be returned for a new setting.
 */
export function embeddingCacheKey(text: string, taskType: TaskType): string {
  const m = embeddingModels.gemini;
  return `emb:${m.id}:${m.dimensions}:${taskType}:${sha256(text)}`;
}

/**
 * Groups texts into batches under both a count cap and a token cap, so one
 * request can't blow the per-minute token budget on its own.
 */
export function planBatches(
  tokenCounts: number[],
  maxItems: number = limits.embedBatchSize,
  maxTokens: number = limits.embedTokensPerMinute,
): number[][] {
  const batches: number[][] = [];
  let current: number[] = [];
  let tokens = 0;
  tokenCounts.forEach((t, i) => {
    if (current.length > 0 && (current.length >= maxItems || tokens + t > maxTokens)) {
      batches.push(current);
      current = [];
      tokens = 0;
    }
    current.push(i);
    tokens += t;
  });
  if (current.length > 0) batches.push(current);
  return batches;
}

export type EmbedProgress = {
  batch: number;
  batches: number;
  cached: number;
  embedded: number;
  waitMs?: number;
};

export type EmbedResult = {
  vectors: number[][];
  cacheHits: number;
  /** Local estimate: the embeddings API returns no usage. */
  embeddedTokens: number;
  batches: number;
};

// Tokens sent in the last minute, shared by every request this server
// instance handles. It can't see other instances, so it's a best effort;
// the 429 retry in fetchWithRetry is the backstop.
const recent: { at: number; tokens: number }[] = [];

async function waitForBudget(tokens: number, onWait?: (ms: number) => void) {
  for (;;) {
    const now = Date.now();
    while (recent.length && now - recent[0].at > 60_000) recent.shift();
    const used = recent.reduce((s, r) => s + r.tokens, 0);
    if (used + tokens <= limits.embedTokensPerMinute || recent.length === 0) {
      recent.push({ at: now, tokens });
      return;
    }
    const waitMs = 60_000 - (now - recent[0].at) + 50;
    onWait?.(waitMs);
    await sleep(waitMs);
  }
}

/** Embeds texts with the cache in front: only misses reach the API. */
export async function embedTexts(
  texts: string[],
  taskType: TaskType,
  onProgress?: (p: EmbedProgress) => void,
): Promise<EmbedResult> {
  const keys = texts.map((t) => embeddingCacheKey(t, taskType));
  const cachedValues = await getMany(keys);
  const vectors: (number[] | null)[] = cachedValues.map((v) => (v ? decodeVector(v) : null));
  const cacheHits = vectors.filter(Boolean).length;

  const missing = texts.flatMap((_, i) => (vectors[i] ? [] : [i]));
  const missingTokens = missing.map((i) => estimateTokens(texts[i]));
  const plan = planBatches(missingTokens);
  let embedded = 0;

  onProgress?.({ batch: 0, batches: plan.length, cached: cacheHits, embedded });

  for (const [b, batch] of plan.entries()) {
    const indexes = batch.map((k) => missing[k]);
    const tokens = batch.reduce((s, k) => s + missingTokens[k], 0);
    await waitForBudget(tokens, (waitMs) =>
      onProgress?.({ batch: b, batches: plan.length, cached: cacheHits, embedded, waitMs }),
    );

    const result = await embedBatchGemini(
      indexes.map((i) => texts[i]),
      taskType,
    );
    indexes.forEach((i, k) => (vectors[i] = result[k]));
    await setMany(
      indexes.map((i, k) => [keys[i], encodeVector(result[k])]),
      CACHE_TTL_SECONDS,
    );
    embedded += indexes.length;
    onProgress?.({ batch: b + 1, batches: plan.length, cached: cacheHits, embedded });
  }

  return {
    vectors: vectors as number[][],
    cacheHits,
    embeddedTokens: missingTokens.reduce((s, t) => s + t, 0),
    batches: plan.length,
  };
}
