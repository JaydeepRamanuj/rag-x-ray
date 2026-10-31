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
  /**
   * The lowest thinking setting the model accepts. All of these are reasoning
   * models that "think" before answering; thinking tokens are billed as output
   * and add latency, so a chat app keeps them as low as the model allows.
   * Gemini calls it thinkingLevel, Groq calls it reasoning_effort.
   */
  reasoning: string;
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
    reasoning: "minimal",
    price: { input: 0.3, cachedInput: 0.03, output: 2.5 },
    // Google no longer publishes fixed free-tier numbers. These are what AI
    // Studio showed for Jd's project on 2026-10-31; yours may differ.
    free: { rpm: 15, tpm: 250_000, rpd: 500 },
  },
  // Stronger model used as the eval judge (Phase 5).
  // Introductory price; rises to $1.50 / $7.50 on 2027-01-01 per Google's schedule.
  geminiFlash: {
    id: "gemini-3.8-flash",
    provider: "gemini",
    label: "Gemini 3.8 Flash",
    // Rejects "minimal" with a 400; "low" is its floor.
    reasoning: "low",
    price: { input: 0.75, cachedInput: 0.075, output: 3.75 },
    // From AI Studio for Jd's project on 2026-10-31. 20 a day is tight: eval
    // runs judge several answers per call so one run fits in a few requests.
    free: { rpm: 5, tpm: 250_000, rpd: 20 },
  },
  // Replaces llama-3.1-8b-instant, which Groq shut down on 2026-08-16.
  groqSmall: {
    id: "openai/gpt-oss-20b",
    provider: "groq",
    label: "GPT-OSS 20B (Groq)",
    contextWindow: 131_072,
    reasoning: "low",
    price: { input: 0.075, cachedInput: 0.037, output: 0.3 },
    free: { rpm: 30, rpd: 1_000, tpm: 8_000, tpd: 200_000 },
  },
  groqLarge: {
    id: "openai/gpt-oss-120b",
    provider: "groq",
    label: "GPT-OSS 120B (Groq)",
    contextWindow: 131_072,
    reasoning: "low",
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
    // Truncated vectors come back un-normalised, so we L2-normalise them.
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
    // Trained on at most 256 word pieces. Transformers.js would accept 512,
    // silently dropping the rest, so lib/embeddings/local.ts caps it here.
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
  // Per 1M tokens (query + documents), from the Rerank 5 launch post; the
  // pricing page's "search unit" FAQ describes older models. Checked
  // 2026-10-31, and the API's billed_units agrees: it reports input_tokens.
  price: { input: 0.02 },
} as const;

export const defaults = {
  chatModel: chatModels.geminiFlashLite.id,
  judgeModel: chatModels.geminiFlash.id,
  embeddingModel: embeddingModels.gemini.id,
  topK: 5,
  temperature: 0.2,
  /** Thinking tokens count against this too, so it can't be very small. */
  maxOutputTokens: 2_048,
  chunkSize: 400, // tokens
  chunkOverlap: 40, // tokens
  /** RRF constant from the original paper; larger k flattens rank differences. */
  rrfK: 60,
  /**
   * How many results each method fetches before fusing or reranking. Hybrid
   * can only promote a chunk that one of its lists found.
   */
  candidates: 20,
} as const;

export const limits = {
  /** Vercel functions time out on long ingestion, so cap per-upload size. */
  maxPagesPerUpload: 50,
  maxTotalPages: 300,
  /** Vercel rejects function request bodies over 4.5 MB. */
  maxUploadBytes: 4 * 1024 * 1024,
  /** ~300 pages at ~500 tokens a page; keeps re-embedding within a day's quota. */
  maxTotalTokens: 150_000,
  /** Texts per batchEmbedContents call; Google caps a batch at 100. */
  embedBatchSize: 100,
  /** Stay under the free tier's embedding tokens-per-minute with some margin. */
  embedTokensPerMinute: 25_000,
  /** Eval mode runs one question at a time with this delay to stay under RPM. */
  evalDelayMs: 4_000,
  retry: { maxAttempts: 4, baseDelayMs: 1_000, maxDelayMs: 30_000 },
} as const;

export const allChatModels: ChatModel[] = Object.values(chatModels);

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
