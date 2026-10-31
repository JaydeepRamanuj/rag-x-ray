/**
 * The single source of truth for model IDs, free-tier limits and paid list
 * prices. Providers retire models and change quotas often, so when one breaks,
 * this file is the only place that should need an edit.
 *
 * Last checked against official docs: 2026-10-31.
 * - Gemini models + prices: https://ai.google.dev/gemini-api/docs/pricing
 * - Gemini limits (per project, shown in AI Studio): https://ai.google.dev/gemini-api/docs/rate-limits
 * - Groq models + prices: https://console.groq.com/docs/models
 * - Groq limits (per account, shown in console): https://console.groq.com/docs/rate-limits
 * - Cohere: https://docs.cohere.com/docs/rate-limits
 */

export type ProviderId = "gemini" | "groq" | "openrouter";

/** Prices are USD per 1M tokens on the paid tier. Our real cost is 0. */
export type Price = {
  input: number;
  cachedInput?: number;
  output: number;
};

/**
 * Free-tier limits as published. They are a guide for throttling, not a
 * guarantee: the console for your own key is authoritative.
 */
export type FreeLimits = {
  rpm?: number; // requests per minute
  rpd?: number; // requests per day
  tpm?: number; // tokens per minute
  tpd?: number; // tokens per day
};

export type ChatModel = {
  id: string;
  provider: ProviderId;
  label: string;
  contextWindow?: number;
  price: Price;
  free: FreeLimits;
};

export type EmbeddingModel = {
  id: string;
  provider: "gemini" | "local";
  label: string;
  /** Must match the pgvector column width the vectors are stored in. */
  dimensions: number;
  maxInputTokens: number;
  price: Pick<Price, "input">;
  free: FreeLimits;
};

export const chatModels = {
  // Default chat model. Newest stable Flash-Lite with a free tier.
  geminiFlashLite: {
    id: "gemini-3.5-flash-lite",
    provider: "gemini",
    label: "Gemini 3.5 Flash-Lite",
    price: { input: 0.3, cachedInput: 0.03, output: 2.5 },
    // Google no longer publishes fixed free-tier numbers; AI Studio shows them.
    free: {},
  },
  // Stronger model used as the eval judge (Phase 5).
  // Price drops back to $1.50 / $7.50 on 2027-01-01 per Google's schedule.
  geminiFlash: {
    id: "gemini-3.8-flash",
    provider: "gemini",
    label: "Gemini 3.8 Flash",
    price: { input: 0.75, cachedInput: 0.075, output: 3.75 },
    free: {},
  },
  // Replaces llama-3.1-8b-instant, which Groq shut down on 2026-08-16.
  groqSmall: {
    id: "openai/gpt-oss-20b",
    provider: "groq",
    label: "GPT-OSS 20B (Groq)",
    price: { input: 0.075, cachedInput: 0.037, output: 0.3 },
    free: { rpm: 30, rpd: 1_000, tpm: 8_000, tpd: 200_000 },
  },
  groqLarge: {
    id: "openai/gpt-oss-120b",
    provider: "groq",
    label: "GPT-OSS 120B (Groq)",
    price: { input: 0.15, cachedInput: 0.075, output: 0.6 },
    free: { rpm: 30, rpd: 1_000, tpm: 8_000, tpd: 200_000 },
  },
} as const satisfies Record<string, ChatModel>;

export const embeddingModels = {
  gemini: {
    id: "gemini-embedding-001",
    provider: "gemini",
    label: "Gemini Embedding 001",
    // Matryoshka-style: 768 is a recommended truncation of the 3072 default.
    dimensions: 768,
    maxInputTokens: 2_048,
    price: { input: 0.15 },
    free: { rpm: 100, rpd: 1_000, tpm: 30_000 },
  },
  local: {
    id: "Xenova/all-MiniLM-L6-v2",
    provider: "local",
    label: "all-MiniLM-L6-v2 (local)",
    dimensions: 384,
    maxInputTokens: 256,
    price: { input: 0 },
    free: {},
  },
} as const satisfies Record<string, EmbeddingModel>;

export const rerankModel = {
  id: "rerank-v5.0-fast",
  provider: "cohere",
  label: "Cohere Rerank 5 Fast",
  // Trial key: 10 calls/minute and 1,000 calls/month in total.
  free: { rpm: 10, callsPerMonth: 1_000 },
  // Cohere's launch post quotes per-token pricing for Rerank 5; re-check the
  // pricing page in Phase 4 when rerank is wired up.
  price: { input: 0.02 },
} as const;

export const defaults = {
  chatModel: chatModels.geminiFlashLite.id,
  judgeModel: chatModels.geminiFlash.id,
  embeddingModel: embeddingModels.gemini.id,
  topK: 5,
  temperature: 0.2,
  chunkSize: 400, // tokens
  chunkOverlap: 40, // tokens
  /** RRF constant from the original paper; larger k flattens rank differences. */
  rrfK: 60,
} as const;

export const limits = {
  /** Vercel functions time out on long ingestion, so cap per-upload size. */
  maxPagesPerUpload: 50,
  maxTotalPages: 300,
  /** Eval mode runs one question at a time with this delay to stay under RPM. */
  evalDelayMs: 4_000,
  retry: { maxAttempts: 4, baseDelayMs: 1_000, maxDelayMs: 30_000 },
} as const;

const allChatModels: ChatModel[] = Object.values(chatModels);

export function getChatModel(id: string): ChatModel {
  const model = allChatModels.find((m) => m.id === id);
  if (!model) throw new Error(`Unknown chat model: ${id}`);
  return model;
}

/** What a call would cost on the paid tier, in USD. */
export function estimateCostUsd(
  price: Price,
  usage: { inputTokens: number; outputTokens: number; cachedTokens?: number },
): number {
  const cached = usage.cachedTokens ?? 0;
  // Cached tokens are a subset of input tokens, billed at the cached rate.
  const uncached = Math.max(0, usage.inputTokens - cached);
  const cachedRate = price.cachedInput ?? price.input;
  return (
    (uncached * price.input + cached * cachedRate + usage.outputTokens * price.output) / 1_000_000
  );
}
