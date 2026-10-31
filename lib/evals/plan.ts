import { chatModels, getChatModel, limits, rerankModel } from "@/lib/config";

import type { EvalRunRow, RunConfig } from "./types";

/**
 * How the browser paces a run. Pure and client-safe, so it's unit-tested.
 * Each delay comes from the tightest free-tier limit the step touches,
 * plus a little margin for clock drift between us and the provider.
 */

const MARGIN_MS = 500;

function perMinute(rpm: number | undefined): number {
  return rpm ? Math.ceil(60_000 / rpm) + MARGIN_MS : 0;
}

/** Wait after each question: the answer model's RPM in full mode, Cohere's when reranking. */
export function itemDelayMs(config: Pick<RunConfig, "mode" | "rerank" | "chatModel">): number {
  const waits = [0];
  if (config.rerank) waits.push(perMinute(rerankModel.free.rpm));
  if (config.mode === "full") {
    const free = getChatModel(config.chatModel).free as { rpm?: number };
    waits.push(Math.max(limits.evalDelayMs, perMinute(free.rpm)));
  }
  return Math.max(...waits);
}

export function judgeDelayMs(judgeModel: string): number {
  const free = getChatModel(judgeModel).free as { rpm?: number };
  return perMinute(free.rpm ?? (chatModels.geminiFlash.free as { rpm?: number }).rpm);
}

export function batches<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export type RemainingWork = { itemIds: string[]; judgeBatches: string[][] };

/**
 * What a run still needs, from its saved state. The same function starts a
 * new run and resumes one left half done by a closed tab. Items that
 * errored are retried; answers without a verdict are judged.
 */
export function remainingWork(run: Pick<EvalRunRow, "config" | "results">): RemainingWork {
  const done = new Set(run.results.items.filter((i) => !i.error).map((i) => i.itemId));
  const itemIds = run.config.itemIds.filter((id) => !done.has(id));
  if (run.config.mode !== "full") return { itemIds, judgeBatches: [] };

  // Everything that will have an answer once the items above are done.
  const answered = new Set([
    ...run.results.items
      .filter((i) => i.answer && i.faithfulness === undefined)
      .map((i) => i.itemId),
    ...itemIds,
  ]);
  const toJudge = run.config.itemIds.filter((id) => answered.has(id));
  return { itemIds, judgeBatches: batches(toJudge, limits.judgeBatchSize) };
}

/** A rough duration for the run button, ignoring the calls' own latency. */
export function estimateMs(config: RunConfig, work: RemainingWork): number {
  return (
    work.itemIds.length * (itemDelayMs(config) + 1_500) +
    work.judgeBatches.length * (judgeDelayMs(config.judgeModel) + 8_000)
  );
}
