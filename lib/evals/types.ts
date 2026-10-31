import { z } from "zod";

import { METHODS } from "@/lib/retrieval/methods";

/**
 * Shared by the /evals page and the API, so it must stay client-safe:
 * no database or Transformers.js imports here.
 */

export const EVAL_MODES = ["retrieval", "full"] as const;
export type EvalMode = (typeof EVAL_MODES)[number];

/** "active" is what chat uses; a strategy picks each document's newest set of it. */
export const CHUNKINGS = ["active", "fixed", "recursive", "sentence", "semantic"] as const;
export type Chunking = (typeof CHUNKINGS)[number];

export const runConfigSchema = z.object({
  /** Retrieval only needs no LLM at all; full also answers and judges. */
  mode: z.enum(EVAL_MODES).default("retrieval"),
  chunking: z.enum(CHUNKINGS).default("active"),
  method: z.enum(METHODS).default("vector"),
  rerank: z.boolean().default(false),
  topK: z.number().int().min(1).max(20).default(5),
  embedding: z.enum(["gemini", "local"]).default("gemini"),
  chatModel: z.string().optional(),
  judgeModel: z.string().optional(),
  /** A note for the history table, such as "hybrid instead of vector". */
  label: z.string().max(80).optional(),
});
export type RunConfigInput = z.input<typeof runConfigSchema>;

/** What's stored on the run: the input plus what it resolved to on the server. */
export type RunConfig = z.output<typeof runConfigSchema> & {
  chatModel: string;
  judgeModel: string;
  chunkSetIds: string[];
  itemIds: string[];
};

export type EvalItem = {
  id: string;
  ordinal: number;
  question: string;
  expectedAnswer: string;
  sourceText: string;
};

export type RetrievedRef = {
  chunkId: string;
  title: string;
  ordinal: number;
  score: number;
  /** Share of the item's source passage this chunk contains (0–1). */
  coverage: number;
};

export type TokenUsage = { inputTokens: number; outputTokens: number; costUsd: number };

export type ItemResult = {
  itemId: string;
  question: string;
  retrieved: RetrievedRef[];
  hitRank: number | null;
  retrievalMs: number;
  answer?: string;
  answerUsage?: TokenUsage;
  answerMs?: number;
  faithfulness?: number | null;
  relevance?: number | null;
  judgeReasoning?: string;
  error?: string;
};

export type JudgeCall = {
  itemIds: string[];
  model: string;
  usage: TokenUsage;
  ms: number;
  /** HTTP attempts, and the status of each failed one (429, 503...). */
  attempts?: number;
  retries?: { status: number; delayMs: number }[];
  error?: string;
};

export type RunResults = { items: ItemResult[]; judgeCalls: JudgeCall[] };

export type RunStatus = "running" | "done" | "error";

export type EvalRunRow = {
  id: string;
  config: RunConfig;
  results: RunResults;
  status: RunStatus;
  error: string | null;
  hitRate: number | null;
  mrr: number | null;
  faithfulness: number | null;
  answerRelevance: number | null;
  totalTokens: number | null;
  costUsd: number | null;
  createdAt: string;
  finishedAt: string | null;
};

/** One line for the history table, e.g. "hybrid + rerank · recursive · k=5". */
export function describeConfig(
  c: Pick<RunConfig, "method" | "rerank" | "chunking" | "topK" | "embedding" | "mode">,
): string {
  const parts = [
    `${c.method}${c.rerank ? " + rerank" : ""}`,
    c.chunking === "active" ? "active sets" : c.chunking,
    `k=${c.topK}`,
  ];
  if (c.method !== "keyword" && c.embedding === "local") parts.push("MiniLM");
  return parts.join(" · ");
}
