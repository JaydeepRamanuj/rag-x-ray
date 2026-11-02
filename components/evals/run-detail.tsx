"use client";

import Link from "next/link";
import { useState } from "react";

import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { HIT_THRESHOLD } from "@/lib/evals/metrics";
import {
  describeConfig,
  type EvalItem,
  type EvalRunRow,
  type ItemResult,
  type JudgeCall,
} from "@/lib/evals/types";
import { formatMs } from "@/lib/format";

import { fixed2, outOf5, pct, RankBadge } from "./shared";

export function RunDetail({ run, items }: { run: EvalRunRow; items: EvalItem[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const byId = new Map(items.map((i) => [i.id, i]));
  const results = new Map(run.results.items.map((r) => [r.itemId, r]));
  const judgeErrors = run.results.judgeCalls.filter((c) => c.error);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">
          {run.config.label ? `${run.config.label}: ` : ""}per question
        </h2>
        <p className="text-muted-foreground text-xs">
          {describeConfig(run.config)} · hit rate {pct(run.hitRate)} · MRR {fixed2(run.mrr)}
          {run.config.mode === "full" &&
            ` · faithfulness ${outOf5(run.faithfulness)} · relevance ${outOf5(run.answerRelevance)}`}
        </p>
      </div>
      {run.error && <p className="text-destructive text-sm">{run.error}</p>}
      {judgeErrors.length > 0 && <JudgeErrors calls={judgeErrors} />}

      <ol className="flex flex-col divide-y rounded-lg border">
        {run.config.itemIds.map((itemId, n) => {
          const r = results.get(itemId);
          const item = byId.get(itemId);
          const isOpen = open === itemId;
          return (
            <li key={itemId}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : itemId)}
                aria-expanded={isOpen}
                className="hover:bg-muted/40 flex w-full items-center gap-3 p-2.5 text-left text-sm"
              >
                <span className="text-muted-foreground w-6 shrink-0 text-right tabular-nums">
                  {n + 1}
                </span>
                {r ? (
                  r.error ? (
                    <Badge variant="destructive">error</Badge>
                  ) : (
                    <RankBadge rank={r.hitRank} />
                  )
                ) : (
                  <Badge variant="outline">pending</Badge>
                )}
                <span className="min-w-0 flex-1 truncate">
                  {r?.question ?? item?.question ?? "(deleted item)"}
                </span>
                {r?.faithfulness !== undefined && (
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    F {r.faithfulness ?? "–"} · R {r.relevance ?? "–"}
                  </span>
                )}
              </button>
              {isOpen && r && <ItemDetail result={r} item={item} topK={run.config.topK} />}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ItemDetail({
  result,
  item,
  topK,
}: {
  result: ItemResult;
  item: EvalItem | undefined;
  topK: number;
}) {
  const arena = `/lab/retrieval?q=${encodeURIComponent(result.question)}&k=${topK}`;
  return (
    <div className="bg-muted/20 grid gap-4 border-t p-4 text-sm lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        {result.error && <p className="text-destructive">{result.error}</p>}
        <div>
          <h4 className="mb-1 text-xs font-medium">
            Retrieved ({formatMs(result.retrievalMs)}) ·{" "}
            <Link href={arena} className="text-primary underline-offset-4 hover:underline">
              open in the arena
            </Link>
          </h4>
          <ol className="flex flex-col gap-1">
            {result.retrieved.map((c, i) => (
              <li key={c.chunkId} className="flex items-center gap-2">
                <span className="text-muted-foreground w-5 text-right tabular-nums">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">
                  {c.title} · chunk {c.ordinal + 1}
                </span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  score {c.score.toFixed(3)}
                </span>
                <CoverageBar value={c.coverage} />
              </li>
            ))}
          </ol>
          <p className="text-muted-foreground mt-1 text-xs">
            The bar is how much of the expected source passage each chunk contains;{" "}
            {HIT_THRESHOLD * 100}% or more counts as a hit.
          </p>
        </div>
        {item && (
          <div>
            <h4 className="mb-1 text-xs font-medium">Expected source passage</h4>
            <blockquote className="text-muted-foreground border-l-2 pl-3">
              {item.sourceText}
            </blockquote>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {result.answer !== undefined ? (
          <>
            <div>
              <h4 className="mb-1 text-xs font-medium">
                Answer ({formatMs(result.answerMs)}, {result.answerUsage?.inputTokens ?? 0} in /{" "}
                {result.answerUsage?.outputTokens ?? 0} out)
              </h4>
              <div className="rounded-md border p-3">
                <Markdown text={result.answer} />
              </div>
            </div>
            {item && (
              <div>
                <h4 className="mb-1 text-xs font-medium">Expected answer</h4>
                <p className="text-muted-foreground">{item.expectedAnswer}</p>
              </div>
            )}
            <div>
              <h4 className="mb-1 text-xs font-medium">
                Judge: faithfulness {result.faithfulness ?? "–"}/5, relevance{" "}
                {result.relevance ?? "–"}/5
              </h4>
              <p className="text-muted-foreground">{result.judgeReasoning ?? "Not judged yet."}</p>
            </div>
          </>
        ) : (
          item && (
            <div>
              <h4 className="mb-1 text-xs font-medium">Expected answer</h4>
              <p className="text-muted-foreground">{item.expectedAnswer}</p>
              <p className="text-muted-foreground mt-2 text-xs">
                Retrieval-only run: no answer was generated.
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function CoverageBar({ value }: { value: number }) {
  return (
    <span
      className="bg-muted relative h-1.5 w-16 shrink-0 overflow-hidden rounded-full"
      title={`${Math.round(value * 100)}% of the source passage`}
    >
      <span
        className={`absolute inset-y-0 left-0 ${value >= HIT_THRESHOLD ? "bg-primary" : "bg-muted-foreground/50"}`}
        style={{ width: `${value * 100}%` }}
      />
    </span>
  );
}

/**
 * Failed judge calls, folded into one line: a daily-quota 429 repeats the same
 * 600-character message for every batch, and the run's resume button
 * (Complete (n)) is what fixes it. The full messages stay one click away.
 */
function JudgeErrors({ calls }: { calls: JudgeCall[] }) {
  const unjudged = calls.reduce((s, c) => s + c.itemIds.length, 0);
  // The provider's first sentence, e.g. "HTTP 429: You exceeded your current quota…".
  const first = calls[0].error!.split(/(?<=\.)\s/)[0];
  return (
    <details className="text-destructive text-sm">
      <summary className="cursor-pointer">
        {calls.length} judge {calls.length === 1 ? "call" : "calls"} failed, so {unjudged} answers
        have no verdict: {first} Use <span className="font-medium">Complete</span> on the run to
        judge them later.
      </summary>
      <ul className="mt-1 flex flex-col gap-1 text-xs">
        {calls.map((c, i) => (
          <li key={i}>
            {c.itemIds.length} answers: {c.error}
          </li>
        ))}
      </ul>
    </details>
  );
}
