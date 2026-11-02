import { asc, eq, sql } from "drizzle-orm";

import { defaults, type ProviderId } from "@/lib/config";

import { getDb } from "./client";
import { chunks, documents, runChunks, runs } from "./schema";

export type NewRun = typeof runs.$inferInsert;
export type NewRunChunk = typeof runChunks.$inferInsert;
export type Run = typeof runs.$inferSelect;

/** The run and the chunks it retrieved, in one transaction. */
export async function insertRun(run: NewRun, chunks: NewRunChunk[] = []): Promise<void> {
  const db = getDb();
  if (chunks.length === 0) {
    await db.insert(runs).values(run);
    return;
  }
  await db.batch([db.insert(runs).values(run), db.insert(runChunks).values(chunks)]);
}

export async function getRun(id: string): Promise<Run | undefined> {
  // Not a valid uuid: Postgres would throw on the cast, so short-circuit.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  const [run] = await getDb().select().from(runs).where(eq(runs.id, id)).limit(1);
  return run;
}

export type RunChunkRow = {
  chunkId: string;
  rank: number;
  score: number;
  usedInPrompt: boolean;
  title: string;
  ordinal: number;
  content: string;
};

/** The chunks a run retrieved, best first, with their text for the inspector. */
export async function getRunChunks(runId: string): Promise<RunChunkRow[]> {
  const rows = await getDb()
    .select({
      chunkId: runChunks.chunkId,
      rank: runChunks.rank,
      score: runChunks.score,
      usedInPrompt: runChunks.usedInPrompt,
      title: documents.title,
      ordinal: chunks.ordinal,
      content: chunks.content,
    })
    .from(runChunks)
    .innerJoin(chunks, eq(chunks.id, runChunks.chunkId))
    .innerJoin(documents, eq(documents.id, chunks.documentId))
    .where(eq(runChunks.runId, runId))
    .orderBy(asc(runChunks.rank));
  return rows.map((r) => ({
    ...r,
    rank: r.rank ?? 0,
    score: r.score ?? 0,
    usedInPrompt: r.usedInPrompt ?? true,
  }));
}

/** Runs re-run from this one in the prompt inspector, oldest first. */
export async function getReruns(parentRunId: string): Promise<Run[]> {
  return getDb()
    .select()
    .from(runs)
    .where(sql`${runs.config}->>'parentRunId' = ${parentRunId}`)
    .orderBy(asc(runs.createdAt));
}

/** The run fields pages pass to client components: plain JSON, no Dates. */
export type RunSummary = {
  id: string;
  question: string;
  answer: string;
  status: string;
  error: string | null;
  model: string;
  provider: ProviderId;
  mode: "raw" | "rag";
  source: string;
  topK: number | null;
  temperature: number;
  maxOutputTokens: number;
  parentRunId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cachedTokens: number | null;
  reasoningTokens: number | null;
  embedTokens: number | null;
  ttftMs: number | null;
  totalMs: number | null;
  estCostUsd: number | null;
  createdAt: string | null;
};

type RunConfig = {
  model: string;
  provider: ProviderId;
  mode?: "raw" | "rag";
  source?: string;
  topK?: number | null;
  temperature?: number;
  maxOutputTokens?: number;
  parentRunId?: string;
};

export function summarizeRun(run: Run): RunSummary {
  const config = run.config as RunConfig;
  return {
    id: run.id,
    question: run.question,
    answer: run.answer ?? "",
    status: run.status,
    error: run.error,
    model: config.model,
    provider: config.provider,
    mode: config.mode ?? "raw",
    source: config.source ?? "chat",
    topK: config.topK ?? null,
    temperature: config.temperature ?? defaults.temperature,
    maxOutputTokens: config.maxOutputTokens ?? defaults.maxOutputTokens,
    parentRunId: config.parentRunId ?? null,
    inputTokens: run.inputTokens,
    outputTokens: run.outputTokens,
    cachedTokens: run.cachedTokens,
    reasoningTokens: run.reasoningTokens,
    embedTokens: run.embedTokens,
    ttftMs: run.ttftMs,
    totalMs: run.totalMs,
    estCostUsd: run.estCostUsd == null ? null : Number(run.estCostUsd),
    createdAt: run.createdAt?.toISOString() ?? null,
  };
}
