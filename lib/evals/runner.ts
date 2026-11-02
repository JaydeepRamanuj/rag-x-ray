import { allChatModels, defaults, estimateCostUsd, getChatModel } from "@/lib/config";
import {
  activeChunkSetIds,
  chunkSetsForStrategy,
  createEvalRun,
  finishEvalRun,
  getChunkTexts,
  getEvalItems,
  listEvalItems,
  reopenEvalRun,
  saveEvalResults,
} from "@/lib/db/evals";
import { getProvider, type Usage } from "@/lib/llm";
import { buildRagMessages, formatSourceBlocks, sourceLabel } from "@/lib/prompt/builder";
import { retrieveForChat } from "@/lib/retrieval";

import { buildJudgeMessages, parseJudgeReply } from "./judge";
import { firstHitRank, sourceCoverage, summarize } from "./metrics";
import type {
  EvalRunRow,
  ItemResult,
  JudgeCall,
  RunConfig,
  RunConfigInput,
  TokenUsage,
} from "./types";
import { runConfigSchema } from "./types";

/**
 * An eval run is a series of small requests sent by the browser: start,
 * one step per question, one judge call per batch, finish. A full run takes
 * several minutes because of the free-tier delays, longer than a Vercel
 * function may run, and steps also make progress easy to show.
 */

export class EvalError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

function knownModel(id: string | undefined, fallback: string): string {
  const chosen = id ?? fallback;
  if (!allChatModels.some((m) => m.id === chosen)) throw new EvalError(`Unknown model: ${chosen}`);
  return chosen;
}

export async function startRun(input: RunConfigInput): Promise<EvalRunRow> {
  const parsed = runConfigSchema.parse(input);
  const items = await listEvalItems();
  if (items.length === 0) throw new EvalError("The eval set is empty. Import or add items first.");

  let chunkSetIds: string[];
  if (parsed.chunking === "active") {
    chunkSetIds = await activeChunkSetIds();
  } else {
    const { ids, missing } = await chunkSetsForStrategy(parsed.chunking);
    if (missing.length > 0) {
      throw new EvalError(
        `${missing.length} document(s) have no ${parsed.chunking} chunk set (${missing.join(", ")}). Create them in the chunking lab first, so every question searches the same strategy.`,
      );
    }
    chunkSetIds = ids;
  }

  const config: RunConfig = {
    ...parsed,
    chatModel: knownModel(parsed.chatModel, defaults.chatModel),
    judgeModel: knownModel(parsed.judgeModel, defaults.judgeModel),
    chunkSetIds,
    itemIds: items.map((i) => i.id),
  };
  return createEvalRun(config);
}

function usageOf(modelId: string, usage: Usage): TokenUsage {
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    costUsd: estimateCostUsd(getChatModel(modelId).price, usage),
  };
}

function assertRunning(run: EvalRunRow) {
  if (run.status !== "running") throw new EvalError(`This run is already ${run.status}.`, 409);
}

/** Retrieves for one question, scores the ranking and, in full mode, answers it. */
export async function runItem(run: EvalRunRow, itemId: string): Promise<ItemResult> {
  assertRunning(run);
  const { config } = run;
  if (!config.itemIds.includes(itemId)) throw new EvalError("That item isn't part of this run.");
  const [item] = await getEvalItems([itemId]);
  if (!item) throw new EvalError("That item was deleted after the run started.", 404);

  const result: ItemResult = {
    itemId,
    question: item.question,
    retrieved: [],
    hitRank: null,
    retrievalMs: 0,
  };

  try {
    const t0 = performance.now();
    const retrieval = await retrieveForChat(item.question, config.method, {
      topK: config.topK,
      model: config.embedding,
      rerank: config.rerank,
      chunkSetIds: config.chunkSetIds,
    });
    result.retrievalMs = Math.round(performance.now() - t0);
    result.retrieved = retrieval.sources.map((s) => ({
      chunkId: s.chunkId,
      title: s.title,
      ordinal: s.ordinal,
      score: s.score,
      coverage: Math.round(sourceCoverage(s.content, item.sourceText) * 100) / 100,
    }));
    result.hitRank = firstHitRank(
      retrieval.sources.map((s) => s.content),
      item.sourceText,
    );

    if (config.mode === "full") {
      const model = getChatModel(config.chatModel);
      const t1 = performance.now();
      const reply = await getProvider(model.provider).chat({
        model,
        messages: buildRagMessages({
          history: [],
          question: item.question,
          sources: retrieval.sources,
        }),
        temperature: defaults.temperature,
        maxOutputTokens: defaults.maxOutputTokens,
      });
      result.answerMs = Math.round(performance.now() - t1);
      result.answer = reply.text;
      result.answerUsage = usageOf(model.id, reply.usage);
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }

  // A retried step replaces its earlier result instead of adding a second one.
  const items = run.results.items.filter((i) => i.itemId !== itemId);
  items.push(result);
  items.sort((a, b) => config.itemIds.indexOf(a.itemId) - config.itemIds.indexOf(b.itemId));
  await saveEvalResults(run.id, { ...run.results, items });
  return result;
}

/** Grades a batch of answered items in a single judge call. */
export async function judgeItems(run: EvalRunRow, itemIds: string[]): Promise<JudgeCall> {
  assertRunning(run);
  const { config } = run;
  if (config.mode !== "full") throw new EvalError("Retrieval-only runs have nothing to judge.");
  const targets = run.results.items.filter((i) => itemIds.includes(i.itemId) && i.answer);
  if (targets.length === 0) throw new EvalError("None of those items has an answer to judge.");

  const texts = await getChunkTexts(targets.flatMap((t) => t.retrieved.map((r) => r.chunkId)));
  // Short ids keep the judge's JSON small and easy for it to copy exactly.
  const caseIds = targets.map((_, i) => `q${i + 1}`);
  const messages = buildJudgeMessages(
    targets.map((t, i) => ({
      id: caseIds[i],
      question: t.question,
      sources: formatSourceBlocks(
        t.retrieved.map((r) => ({
          label: sourceLabel(r),
          content: texts.get(r.chunkId) ?? "(chunk deleted since the run)",
        })),
      ),
      answer: t.answer!,
    })),
  );

  const model = getChatModel(config.judgeModel);
  const t0 = performance.now();
  const call: JudgeCall = {
    itemIds: targets.map((t) => t.itemId),
    model: model.id,
    usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
    ms: 0,
  };
  try {
    const reply = await getProvider(model.provider).chat({
      model,
      messages,
      temperature: 0,
      // Room for the judge's thinking plus a short verdict per case.
      maxOutputTokens: 8_192,
      json: true,
      onRetry: (r) => (call.retries ??= []).push({ status: r.status, delayMs: r.delayMs }),
    });
    call.attempts = reply.attempts;
    call.usage = usageOf(model.id, reply.usage);
    const verdicts = parseJudgeReply(reply.text, caseIds);
    if (verdicts.size < targets.length) {
      call.error = `The judge returned ${verdicts.size} of ${targets.length} verdicts.`;
    }
    targets.forEach((t, i) => {
      const v = verdicts.get(caseIds[i]);
      t.faithfulness = v?.faithfulness ?? null;
      t.relevance = v?.relevance ?? null;
      t.judgeReasoning = v?.reasoning ?? "No verdict from the judge for this item.";
    });
  } catch (err) {
    call.error = err instanceof Error ? err.message : String(err);
  }
  call.ms = Math.round(performance.now() - t0);

  const judgeCalls = [
    ...run.results.judgeCalls.filter((c) => !c.itemIds.some((id) => call.itemIds.includes(id))),
    call,
  ];
  await saveEvalResults(run.id, { items: run.results.items, judgeCalls });
  return call;
}

export function runTotals(run: EvalRunRow): { totalTokens: number; costUsd: number } {
  const usages = [
    ...run.results.items.flatMap((i) => (i.answerUsage ? [i.answerUsage] : [])),
    ...run.results.judgeCalls.map((c) => c.usage),
  ];
  return {
    totalTokens: usages.reduce((s, u) => s + u.inputTokens + u.outputTokens, 0),
    costUsd: usages.reduce((s, u) => s + u.costUsd, 0),
  };
}

/**
 * Reopens a finished run whose judge calls failed (Gemini Flash answers 503
 * "high demand" at busy times), so the browser can send the missing steps.
 */
export async function reopenRun(run: EvalRunRow): Promise<void> {
  if (run.status === "running") return;
  await reopenEvalRun(run.id);
}

/** Scores whatever was completed. A run with no completed items is marked as an error. */
export async function finishRun(run: EvalRunRow, error?: string): Promise<void> {
  assertRunning(run);
  const done = run.results.items.filter((i) => !i.error);
  const scores = summarize(done);
  const failed = !!error || done.length === 0;
  await finishEvalRun(run.id, {
    ...scores,
    ...runTotals(run),
    status: failed ? "error" : "done",
    error: error ?? (done.length === 0 ? "No item completed." : null),
  });
}
