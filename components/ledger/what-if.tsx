"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { allChatModels, defaults, getChatModel } from "@/lib/config";
import type { RunSummary } from "@/lib/db/runs";
import { formatInt, formatUsd } from "@/lib/format";
import { embedCostUsd, whatIfCost, type RunForWhatIf } from "@/lib/tokens/cost";

const TOP_K = [1, 3, 5, 8, 10, 15, 20];
const CHUNK_SIZES = [200, 400, 600, 800, 1000];
const PER = 1_000;

export type LedgerRow = RunSummary & { whatIf: RunForWhatIf | null };

export function WhatIf({ row }: { row: LedgerRow }) {
  const w = row.whatIf;
  const knownModel = allChatModels.some((m) => m.id === row.model);
  const [model, setModel] = useState(knownModel ? row.model : defaults.chatModel);
  const [topK, setTopK] = useState(w?.sourceCount || row.topK || defaults.topK);
  // "" keeps the run's actual average chunk size.
  const [chunkSize, setChunkSize] = useState("");
  const [cachePrefix, setCachePrefix] = useState(false);

  if (!w) {
    return (
      <p className="text-muted-foreground text-sm">
        This run has no usage report (it failed before the provider replied), so there is nothing to
        re-price.
      </p>
    );
  }

  const rag = w.sourceCount > 0;
  const scenario = whatIfCost(w, {
    model: getChatModel(model),
    topK,
    chunkSize: chunkSize ? Number(chunkSize) : undefined,
    cachePrefix,
  });
  const actualEmbed = embedCostUsd(w.embedTokens);
  const actual = {
    inputTokens: w.inputTokens,
    cachedTokens: w.cachedTokens,
    outputTokens: w.outputTokens,
    chatUsd: row.estCostUsd ?? 0,
    embedUsd: actualEmbed,
    totalUsd: (row.estCostUsd ?? 0) + actualEmbed,
  };
  const avgChunk = rag ? Math.round(w.sourceEstimate / w.sourceCount) : 0;

  const rows: { label: string; a: number; b: number; usd?: boolean }[] = [
    { label: "Input tokens", a: actual.inputTokens, b: scenario.inputTokens },
    { label: "of which cached", a: actual.cachedTokens, b: scenario.cachedTokens },
    { label: "Output tokens (held constant)", a: actual.outputTokens, b: scenario.outputTokens },
    { label: "Chat cost", a: actual.chatUsd, b: scenario.chatUsd, usd: true },
    { label: "Query embedding cost", a: actual.embedUsd, b: scenario.embedUsd, usd: true },
    { label: "Total per question", a: actual.totalUsd, b: scenario.totalUsd, usd: true },
    {
      label: `Per ${formatInt(PER)} questions`,
      a: actual.totalUsd * PER,
      b: scenario.totalUsd * PER,
      usd: true,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm">
        <span className="font-medium">{row.question}</span>{" "}
        <Link
          href={`/runs/${row.id}/prompt`}
          className="text-muted-foreground text-xs underline underline-offset-2"
        >
          inspect
        </Link>
        <div className="text-muted-foreground font-mono text-xs">
          {rag
            ? `${w.sourceCount} sources of ≈${formatInt(avgChunk)} tokens = ${Math.round((w.sourceEstimate / w.promptEstimate) * 100)}% of the prompt`
            : "no retrieval"}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <NativeSelect value={model} onChange={(e) => setModel(e.target.value)} aria-label="Model">
          {allChatModels.map((m) => (
            <NativeSelectOption key={m.id} value={m.id}>
              {m.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          value={String(topK)}
          onChange={(e) => setTopK(Number(e.target.value))}
          aria-label="Top-k"
          disabled={!rag}
        >
          {TOP_K.map((k) => (
            <NativeSelectOption key={k} value={k}>
              top {k}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          value={chunkSize}
          onChange={(e) => setChunkSize(e.target.value)}
          aria-label="Chunk size"
          disabled={!rag}
        >
          <NativeSelectOption value="">chunks as retrieved (≈{avgChunk})</NativeSelectOption>
          {CHUNK_SIZES.map((c) => (
            <NativeSelectOption key={c} value={c}>
              {c}-token chunks
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <div className="flex items-center gap-2">
          <Switch id="cache-prefix" checked={cachePrefix} onCheckedChange={setCachePrefix} />
          <Label htmlFor="cache-prefix">Cache system prompt + history</Label>
        </div>
        {scenario.approximate && (
          <Badge variant="outline" title="Different tokenizer: counts use our o200k estimate">
            other provider: approximate
          </Badge>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground text-left text-xs">
            <tr>
              <th className="py-1 font-normal" />
              <th className="py-1 text-right font-normal">This run</th>
              <th className="py-1 text-right font-normal">What if</th>
              <th className="py-1 text-right font-normal">Change</th>
            </tr>
          </thead>
          <tbody className="font-mono text-xs">
            {rows.map((r) => {
              const change = r.a > 0 ? ((r.b - r.a) / r.a) * 100 : null;
              return (
                <tr key={r.label} className="border-t">
                  <td className="py-1.5 font-sans text-sm">{r.label}</td>
                  <td className="text-right">{r.usd ? formatUsd(r.a) : formatInt(r.a)}</td>
                  <td className="text-right">{r.usd ? formatUsd(r.b) : formatInt(r.b)}</td>
                  <td
                    className={
                      change == null || Math.abs(change) < 0.5
                        ? "text-muted-foreground text-right"
                        : change < 0
                          ? "text-right text-emerald-600"
                          : "text-right text-amber-600"
                    }
                  >
                    {change == null ? "–" : `${change > 0 ? "+" : ""}${change.toFixed(0)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">
        Input is re-estimated from this run&apos;s own prompt: the non-source part stays, the
        sources become top-k × chunk size, and the result is scaled by how far the provider&apos;s
        real count differed from our estimate for this run. Output can&apos;t be predicted without
        running the model, so it&apos;s held constant. Caching prices the stable prefix at the
        model&apos;s cached-input rate, as Gemini&apos;s implicit caching does once a prefix
        repeats.
      </p>
    </div>
  );
}
