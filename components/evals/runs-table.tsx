"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { judgedCount } from "@/lib/evals/metrics";
import { remainingWork } from "@/lib/evals/plan";
import { describeConfig, type EvalRunRow } from "@/lib/evals/types";
import { formatInt, formatUsd } from "@/lib/format";

import { fixed2, outOf5, pct, shortDate } from "./shared";

export function RunsTable({
  runs,
  selected,
  compare,
  busy,
  activeRunId,
  onSelect,
  onToggleCompare,
  onResume,
  onDelete,
}: {
  runs: EvalRunRow[];
  selected: string | null;
  compare: string[];
  busy: boolean;
  activeRunId: string | null;
  onSelect: (id: string) => void;
  onToggleCompare: (id: string) => void;
  onResume: (run: EvalRunRow) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold">Runs</h2>
        <p className="text-muted-foreground text-xs">
          Tick two runs to compare them. Click a row for per-question results.
        </p>
      </div>
      {runs.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
          No runs yet. Start with a retrieval-only baseline: it costs no LLM calls.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
              <tr>
                <th className="p-2 font-medium">
                  <span className="sr-only">Compare</span>
                </th>
                <th className="p-2 font-medium">When</th>
                <th className="min-w-56 p-2 font-medium">Run</th>
                <th className="p-2 text-right font-medium">Hit rate</th>
                <th className="p-2 text-right font-medium">MRR</th>
                <th className="p-2 text-right font-medium">Faithful</th>
                <th className="p-2 text-right font-medium">Relevant</th>
                <th className="p-2 text-right font-medium">Tokens</th>
                <th className="p-2 text-right font-medium">Paid-tier cost</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const done = run.results.items.filter((i) => !i.error).length;
                const total = run.config.itemIds.length;
                const work = remainingWork(run);
                const left = work.itemIds.length + work.judgeBatches.length;
                // A full run whose judge calls failed partway averages fewer answers.
                const judged = judgedCount(run.results.items);
                const partial = run.config.mode === "full" && judged < done;
                return (
                  <tr
                    key={run.id}
                    onClick={() => onSelect(run.id)}
                    className={`hover:bg-muted/40 cursor-pointer border-t ${selected === run.id ? "bg-muted/60" : ""}`}
                  >
                    <td className="p-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label="Compare this run"
                        checked={compare.includes(run.id)}
                        onChange={() => onToggleCompare(run.id)}
                      />
                    </td>
                    <td className="text-muted-foreground p-2 whitespace-nowrap">
                      {shortDate(run.createdAt)}
                    </td>
                    <td className="p-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {run.config.label && (
                          <span className="font-medium">{run.config.label}</span>
                        )}
                        <span className="text-muted-foreground">{describeConfig(run.config)}</span>
                        {run.config.mode === "full" && <Badge variant="outline">full</Badge>}
                        {run.status === "running" && (
                          <Badge variant="secondary">
                            {activeRunId === run.id ? "running" : "unfinished"} {done}/{total}
                          </Badge>
                        )}
                        {run.status === "error" && (
                          <Badge variant="destructive" title={run.error ?? undefined}>
                            {done}/{total} done
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-2 text-right tabular-nums">{pct(run.hitRate)}</td>
                    <td className="p-2 text-right tabular-nums">{fixed2(run.mrr)}</td>
                    <td className="p-2 text-right tabular-nums">
                      {outOf5(run.faithfulness)}
                      {partial && <JudgedNote judged={judged} total={done} />}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {outOf5(run.answerRelevance)}
                      {partial && <JudgedNote judged={judged} total={done} />}
                    </td>
                    <td className="p-2 text-right tabular-nums">{formatInt(run.totalTokens)}</td>
                    <td className="p-2 text-right tabular-nums">{formatUsd(run.costUsd)}</td>
                    <td
                      className="p-2 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {left > 0 && activeRunId !== run.id && (
                        <Button
                          size="xs"
                          variant="outline"
                          disabled={busy}
                          title={`${left} step(s) left: unanswered questions or unjudged answers`}
                          onClick={() => onResume(run)}
                        >
                          {run.status === "running" ? "Resume" : `Complete (${left})`}
                        </Button>
                      )}
                      <Button
                        size="xs"
                        variant="ghost"
                        disabled={activeRunId === run.id}
                        onClick={() => onDelete(run.id)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function JudgedNote({ judged, total }: { judged: number; total: number }) {
  return (
    <span className="text-muted-foreground block text-xs">
      {judged} of {total} judged
    </span>
  );
}
