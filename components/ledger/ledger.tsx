"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { allChatModels, estimateCostUsd } from "@/lib/config";
import type { EvalDay, IngestDay, ModelDay } from "@/lib/db/ledger";
import { formatInt, formatMs, formatUsd } from "@/lib/format";
import { embedCostUsd } from "@/lib/tokens/cost";
import { cn } from "@/lib/utils";

import { UsageChart } from "./usage-chart";
import { WhatIf, type LedgerRow } from "./what-if";

type Props = {
  rows: LedgerRow[];
  days: string[];
  usage: { models: ModelDay[]; ingest: IngestDay[]; evals: EvalDay[] };
  initialRunId?: string;
  maxRuns: number;
};

const label = (id: string) => allChatModels.find((m) => m.id === id)?.label ?? id;

export function Ledger({ rows, days, usage, initialRunId, maxRuns }: Props) {
  const [selectedId, setSelectedId] = useState(
    rows.find((r) => r.id === initialRunId)?.id ?? rows.find((r) => r.whatIf)?.id,
  );
  const whatIfRef = useRef<HTMLElement>(null);
  const selected = rows.find((r) => r.id === selectedId);

  // Split each run's paid-tier price into its input and output halves, to
  // show which side of the bill RAG actually spends on.
  let inputUsd = 0;
  let outputUsd = 0;
  let embedUsd = 0;
  for (const r of rows) {
    const price = allChatModels.find((m) => m.id === r.model)?.price;
    if (price) {
      inputUsd += estimateCostUsd(price, {
        inputTokens: r.inputTokens ?? 0,
        cachedTokens: r.cachedTokens ?? 0,
        outputTokens: 0,
      });
      outputUsd += estimateCostUsd(price, { inputTokens: 0, outputTokens: r.outputTokens ?? 0 });
    }
    embedUsd += embedCostUsd(r.embedTokens ?? 0);
  }
  const sum = (f: (r: LedgerRow) => number | null) => rows.reduce((s, r) => s + (f(r) ?? 0), 0);
  const totalUsd = inputUsd + outputUsd + embedUsd;

  const tiles: [string, string, string?][] = [
    ["Runs", formatInt(rows.length), rows.length >= maxRuns ? `latest ${maxRuns}` : undefined],
    [
      "Input tokens",
      formatInt(sum((r) => r.inputTokens)),
      `${formatInt(sum((r) => r.cachedTokens))} cached`,
    ],
    [
      "Output tokens",
      formatInt(sum((r) => r.outputTokens)),
      `${formatInt(sum((r) => r.reasoningTokens))} thinking (logged from Phase 3)`,
    ],
    ["Cost if paid", formatUsd(totalUsd), "your real cost: $0"],
    [
      "Spent on input",
      totalUsd ? `${Math.round((inputUsd / totalUsd) * 100)}%` : "–",
      `output ${totalUsd ? Math.round((outputUsd / totalUsd) * 100) : 0}%, embeddings ${totalUsd ? Math.round((embedUsd / totalUsd) * 100) : 0}%`,
    ],
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {tiles.map(([title, value, note]) => (
          <div key={title} className="flex flex-col gap-0.5 rounded-lg border p-3">
            <div className="text-muted-foreground text-xs">{title}</div>
            <div className="font-mono text-lg font-semibold">{value}</div>
            {note && <div className="text-muted-foreground text-xs">{note}</div>}
          </div>
        ))}
      </div>

      <UsageChart days={days} models={usage.models} ingest={usage.ingest} evals={usage.evals} />

      <section ref={whatIfRef} className="flex scroll-mt-4 flex-col gap-3">
        <h2 className="font-semibold">What if?</h2>
        {selected ? (
          // Keyed by run so the controls reset to the new run's settings.
          <WhatIf key={selected.id} row={selected} />
        ) : (
          <p className="text-muted-foreground text-sm">Pick a run in the table below.</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Runs</h2>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No runs yet. Ask something in{" "}
            <Link href="/chat" className="underline">
              Chat
            </Link>
            .
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground bg-muted/40 text-left text-xs">
                <tr>
                  {[
                    "When",
                    "Question",
                    "Model",
                    "Source",
                    "Embed",
                    "Input",
                    "Cached",
                    "Output",
                    "TTFT",
                    "Total",
                    "Cost if paid",
                  ].map((h, i) => (
                    <th key={h} className={cn("px-2 py-2 font-normal", i >= 4 && "text-right")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-mono text-xs">
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => {
                      setSelectedId(r.id);
                      whatIfRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className={cn(
                      "hover:bg-muted/50 cursor-pointer border-t",
                      r.id === selectedId && "bg-muted",
                    )}
                  >
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {r.createdAt
                        ? new Date(r.createdAt).toLocaleString("en-GB", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "–"}
                    </td>
                    <td className="max-w-64 truncate px-2 font-sans" title={r.question}>
                      <Link
                        href={`/runs/${r.id}/prompt`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:underline"
                      >
                        {r.question}
                      </Link>
                    </td>
                    <td className="px-2 font-sans whitespace-nowrap">{label(r.model)}</td>
                    <td className="px-2 font-sans">
                      {r.source}
                      {r.mode === "rag" ? " · rag" : ""}
                      {r.status !== "ok" && (
                        <span
                          className={r.status === "error" ? "text-destructive" : "text-amber-600"}
                        >
                          {" "}
                          · {r.status}
                        </span>
                      )}
                    </td>
                    <td className="px-2 text-right">
                      {r.embedTokens ? formatInt(r.embedTokens) : "–"}
                    </td>
                    <td className="px-2 text-right">{formatInt(r.inputTokens)}</td>
                    <td className="px-2 text-right">
                      {r.cachedTokens ? formatInt(r.cachedTokens) : "–"}
                    </td>
                    <td className="px-2 text-right whitespace-nowrap">
                      {formatInt(r.outputTokens)}
                      {r.reasoningTokens ? (
                        <span className="text-muted-foreground">
                          {" "}
                          ({formatInt(r.reasoningTokens)})
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 text-right">{formatMs(r.ttftMs)}</td>
                    <td className="px-2 text-right">{formatMs(r.totalMs)}</td>
                    <td className="px-2 text-right">
                      {formatUsd(
                        r.estCostUsd == null
                          ? null
                          : r.estCostUsd + embedCostUsd(r.embedTokens ?? 0),
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-muted-foreground text-xs">
          Click a row to re-price it above; click a question to inspect its prompt. Output in
          brackets is thinking. Cost includes the query embedding at Gemini Embedding&apos;s list
          price.
        </p>
      </section>
    </div>
  );
}
