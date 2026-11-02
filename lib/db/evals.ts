import { asc, desc, eq, inArray } from "drizzle-orm";

import type { EvalItem, EvalRunRow, RunConfig, RunResults, RunStatus } from "@/lib/evals/types";
import type { RunScores } from "@/lib/evals/metrics";

import { getDb, getSql } from "./client";
import { evalItems, evalRuns } from "./schema";

export async function listEvalItems(): Promise<EvalItem[]> {
  return getDb()
    .select({
      id: evalItems.id,
      ordinal: evalItems.ordinal,
      question: evalItems.question,
      expectedAnswer: evalItems.expectedAnswer,
      sourceText: evalItems.sourceText,
    })
    .from(evalItems)
    .orderBy(asc(evalItems.ordinal), asc(evalItems.question));
}

export type NewEvalItem = Omit<EvalItem, "id" | "ordinal">;

/** Appends items after the current last one. */
export async function insertEvalItems(items: NewEvalItem[]): Promise<number> {
  if (items.length === 0) return 0;
  const sql = getSql();
  const [{ next }] = await sql`SELECT coalesce(max(ordinal), 0) + 1 AS next FROM eval_items`;
  await getDb()
    .insert(evalItems)
    .values(items.map((item, i) => ({ ...item, ordinal: Number(next) + i })));
  return items.length;
}

export async function updateEvalItem(id: string, patch: Partial<NewEvalItem>): Promise<boolean> {
  const rows = await getDb()
    .update(evalItems)
    .set(patch)
    .where(eq(evalItems.id, id))
    .returning({ id: evalItems.id });
  return rows.length > 0;
}

export async function deleteEvalItem(id: string): Promise<boolean> {
  const rows = await getDb()
    .delete(evalItems)
    .where(eq(evalItems.id, id))
    .returning({ id: evalItems.id });
  return rows.length > 0;
}

export async function getEvalItems(ids: string[]): Promise<EvalItem[]> {
  if (ids.length === 0) return [];
  return getDb()
    .select({
      id: evalItems.id,
      ordinal: evalItems.ordinal,
      question: evalItems.question,
      expectedAnswer: evalItems.expectedAnswer,
      sourceText: evalItems.sourceText,
    })
    .from(evalItems)
    .where(inArray(evalItems.id, ids));
}

function toRow(r: typeof evalRuns.$inferSelect): EvalRunRow {
  return {
    id: r.id,
    config: r.config as RunConfig,
    results: r.results as RunResults,
    status: r.status as RunStatus,
    error: r.error,
    hitRate: r.hitRate,
    mrr: r.mrr,
    faithfulness: r.faithfulness,
    answerRelevance: r.answerRelevance,
    totalTokens: r.totalTokens,
    costUsd: r.costUsd,
    createdAt: (r.createdAt ?? new Date()).toISOString(),
    finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
  };
}

export async function createEvalRun(config: RunConfig): Promise<EvalRunRow> {
  const results: RunResults = { items: [], judgeCalls: [] };
  const [row] = await getDb().insert(evalRuns).values({ config, results }).returning();
  return toRow(row);
}

export async function getEvalRun(id: string): Promise<EvalRunRow | undefined> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  const [row] = await getDb().select().from(evalRuns).where(eq(evalRuns.id, id)).limit(1);
  return row ? toRow(row) : undefined;
}

export async function listEvalRuns(limit = 50): Promise<EvalRunRow[]> {
  const rows = await getDb().select().from(evalRuns).orderBy(desc(evalRuns.createdAt)).limit(limit);
  return rows.map(toRow);
}

/**
 * Steps are sent one at a time by the browser, so a read-modify-write of
 * the results is safe without locking.
 */
export async function saveEvalResults(id: string, results: RunResults): Promise<void> {
  await getDb().update(evalRuns).set({ results }).where(eq(evalRuns.id, id));
}

export async function finishEvalRun(
  id: string,
  outcome: RunScores & {
    status: Exclude<RunStatus, "running">;
    error?: string | null;
    totalTokens: number;
    costUsd: number;
  },
): Promise<void> {
  await getDb()
    .update(evalRuns)
    .set({
      status: outcome.status,
      error: outcome.error ?? null,
      hitRate: outcome.hitRate,
      mrr: outcome.mrr,
      faithfulness: outcome.faithfulness,
      answerRelevance: outcome.answerRelevance,
      totalTokens: outcome.totalTokens,
      costUsd: outcome.costUsd,
      finishedAt: new Date(),
    })
    .where(eq(evalRuns.id, id));
}

/** Puts a finished run back to "running" so missing steps can be sent again. */
export async function reopenEvalRun(id: string): Promise<void> {
  await getDb()
    .update(evalRuns)
    .set({ status: "running", error: null, finishedAt: null })
    .where(eq(evalRuns.id, id));
}

export async function deleteEvalRun(id: string): Promise<boolean> {
  const rows = await getDb()
    .delete(evalRuns)
    .where(eq(evalRuns.id, id))
    .returning({ id: evalRuns.id });
  return rows.length > 0;
}

/** Chunk text by id, for the judge and the drill-down. Deleted chunks are just missing. */
export async function getChunkTexts(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const sql = getSql();
  const rows = await sql`SELECT id, content FROM chunks WHERE id = ANY(${ids}::uuid[])`;
  return new Map(rows.map((r) => [r.id as string, r.content as string]));
}

/**
 * Resolves a chunking choice to chunk set ids: each document's newest set
 * of that strategy. Documents without one are returned so the caller can
 * refuse the run rather than quietly mixing strategies.
 */
export async function chunkSetsForStrategy(
  strategy: string,
): Promise<{ ids: string[]; missing: string[] }> {
  const sql = getSql();
  const rows = await sql`
    SELECT d.title,
           (SELECT cs.id FROM chunk_sets cs
            WHERE cs.document_id = d.id AND cs.strategy = ${strategy}
            ORDER BY cs.created_at DESC LIMIT 1) AS set_id
    FROM documents d
    ORDER BY d.title
  `;
  return {
    ids: rows.filter((r) => r.set_id).map((r) => r.set_id as string),
    missing: rows.filter((r) => !r.set_id).map((r) => r.title as string),
  };
}

export async function activeChunkSetIds(): Promise<string[]> {
  const sql = getSql();
  const rows = await sql`SELECT id FROM chunk_sets WHERE is_active`;
  return rows.map((r) => r.id as string);
}
