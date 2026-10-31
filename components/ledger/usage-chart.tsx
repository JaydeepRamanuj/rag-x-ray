"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { allChatModels, embeddingModels, type FreeLimits } from "@/lib/config";
import type { EvalDay, IngestDay, ModelDay } from "@/lib/db/ledger";
import { formatInt } from "@/lib/format";

const EMBEDDINGS = "embeddings";

const requestConfig = {
  chat: { label: "Chat requests", color: "#0ea5e9" },
  evals: { label: "Eval requests", color: "#f43f5e" },
  queries: { label: "Query embeddings", color: "#0ea5e9" },
  uploads: { label: "Upload batches", color: "#8b5cf6" },
} satisfies ChartConfig;

const tokenConfig = {
  input: { label: "Input", color: "#f59e0b" },
  cached: { label: "Cached input", color: "#fcd34d" },
  output: { label: "Output", color: "#10b981" },
  evals: { label: "Eval tokens", color: "#f43f5e" },
  queries: { label: "Query embeddings", color: "#0ea5e9" },
  uploads: { label: "Upload embeddings", color: "#8b5cf6" },
} satisfies ChartConfig;

type Point = Record<string, number | string>;

/** "2026-10-31" → "31 Oct", parsed as UTC so the browser's zone can't shift it. */
function shortDay(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function UsageChart({
  days,
  models,
  ingest,
  evals,
}: {
  days: string[];
  models: ModelDay[];
  ingest: IngestDay[];
  evals: EvalDay[];
}) {
  const used = new Set([...models, ...evals].map((m) => m.model));
  const [target, setTarget] = useState<string>(
    allChatModels.find((m) => used.has(m.id))?.id ?? allChatModels[0].id,
  );
  const [showQuota, setShowQuota] = useState(true);

  const isEmbed = target === EMBEDDINGS;
  const limits: FreeLimits = isEmbed
    ? embeddingModels.gemini.free
    : (allChatModels.find((m) => m.id === target)?.free ?? {});

  const requests = days.map((day): Point => {
    const rows = models.filter((m) => m.day === day);
    if (isEmbed) {
      return {
        day,
        queries: rows.reduce((s, r) => s + r.embedRequests, 0),
        uploads: ingest.find((i) => i.day === day)?.requests ?? 0,
      };
    }
    const e = evals.find((x) => x.day === day && x.model === target);
    return {
      day,
      chat: rows.find((r) => r.model === target)?.requests ?? 0,
      evals: e?.requests ?? 0,
    };
  });
  const tokens = days.map((day): Point => {
    const rows = models.filter((m) => m.day === day);
    if (isEmbed) {
      return {
        day,
        queries: rows.reduce((s, r) => s + r.embedTokens, 0),
        uploads: ingest.find((i) => i.day === day)?.embedTokens ?? 0,
      };
    }
    const r = rows.find((x) => x.model === target);
    const e = evals.find((x) => x.day === day && x.model === target);
    return {
      day,
      // Cached tokens are part of input; split them out so the stack adds up.
      input: (r?.inputTokens ?? 0) - (r?.cachedTokens ?? 0),
      cached: r?.cachedTokens ?? 0,
      output: r?.outputTokens ?? 0,
      evals: (e?.inputTokens ?? 0) + (e?.outputTokens ?? 0),
    };
  });

  const requestKeys = isEmbed ? ["queries", "uploads"] : ["chat", "evals"];
  const tokenKeys = isEmbed ? ["queries", "uploads"] : ["input", "cached", "output", "evals"];
  const maxRequests = Math.max(
    0,
    ...requests.map((p) => requestKeys.reduce((s, k) => s + Number(p[k]), 0)),
  );
  const maxTokens = Math.max(
    0,
    ...tokens.map((p) => tokenKeys.reduce((s, k) => s + Number(p[k]), 0)),
  );
  const ofTarget = models.filter((m) => m.model === target);
  const peakRpm = Math.max(0, ...ofTarget.map((m) => m.peakRpm));
  const peakTpm = Math.max(0, ...ofTarget.map((m) => m.peakTpm));

  // With the quota line on, the axis ends at the limit, which makes how little
  // of the free tier you use the visible point. Off (or once usage passes the
  // limit), it scales to the data.
  const requestMax = showQuota && limits.rpd && maxRequests <= limits.rpd ? limits.rpd : "auto";
  const tokenMax = showQuota && limits.tpd && maxTokens <= limits.tpd ? limits.tpd : "auto";

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Daily usage, last {days.length} days</h2>
        <div className="flex flex-wrap items-center gap-3">
          <NativeSelect
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            aria-label="Quota to show"
          >
            {allChatModels.map((m) => (
              <NativeSelectOption key={m.id} value={m.id}>
                {m.label}
              </NativeSelectOption>
            ))}
            <NativeSelectOption value={EMBEDDINGS}>
              {embeddingModels.gemini.label}
            </NativeSelectOption>
          </NativeSelect>
          <div className="flex items-center gap-2">
            <Switch id="quota" checked={showQuota} onCheckedChange={setShowQuota} />
            <Label htmlFor="quota">Scale to the free quota</Label>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-sm font-medium">
            Requests per day{" "}
            <span className="text-muted-foreground font-normal">
              {limits.rpd
                ? `· free limit ${formatInt(limits.rpd)}/day`
                : "· no daily limit recorded"}
            </span>
          </h3>
          <ChartContainer config={requestConfig} className="aspect-auto h-56 w-full">
            <BarChart data={requests} margin={{ left: 0, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="day" tickFormatter={shortDay} tickLine={false} axisLine={false} />
              <YAxis domain={[0, requestMax]} allowDecimals={false} width={40} tickLine={false} />
              <ChartTooltip
                content={<ChartTooltipContent labelFormatter={(d) => shortDay(String(d))} />}
              />
              {requestKeys.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
              {requestKeys.map((k) => (
                <Bar key={k} dataKey={k} stackId="r" fill={`var(--color-${k})`} />
              ))}
              {showQuota && limits.rpd && (
                <ReferenceLine
                  y={limits.rpd}
                  stroke="var(--destructive)"
                  strokeDasharray="4 4"
                  label={{ value: "free limit", position: "insideTopRight", fontSize: 11 }}
                />
              )}
            </BarChart>
          </ChartContainer>
        </div>

        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-sm font-medium">
            Tokens per day{" "}
            <span className="text-muted-foreground font-normal">
              {limits.tpd ? `· free limit ${formatInt(limits.tpd)}/day` : "· no daily token limit"}
            </span>
          </h3>
          <ChartContainer config={tokenConfig} className="aspect-auto h-56 w-full">
            <BarChart data={tokens} margin={{ left: 0, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="day" tickFormatter={shortDay} tickLine={false} axisLine={false} />
              <YAxis
                domain={[0, tokenMax]}
                width={48}
                tickLine={false}
                tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
              />
              <ChartTooltip
                content={<ChartTooltipContent labelFormatter={(d) => shortDay(String(d))} />}
              />
              <ChartLegend content={<ChartLegendContent />} />
              {tokenKeys.map((k) => (
                <Bar key={k} dataKey={k} stackId="t" fill={`var(--color-${k})`} />
              ))}
              {showQuota && limits.tpd && (
                <ReferenceLine
                  y={limits.tpd}
                  stroke="var(--destructive)"
                  strokeDasharray="4 4"
                  label={{ value: "free limit", position: "insideTopRight", fontSize: 11 }}
                />
              )}
            </BarChart>
          </ChartContainer>
        </div>
      </div>

      <p className="text-muted-foreground text-xs leading-relaxed">
        Days run midnight to midnight Pacific, when Gemini&apos;s daily quota resets.{" "}
        {isEmbed ? (
          <>
            Only embedding calls that missed the cache count: a cached query or chunk never reaches
            Google. Upload usage is logged from Phase 3 on, so earlier uploads don&apos;t appear.
            Embedding tokens are local estimates, because the API reports none.
          </>
        ) : (
          <>
            Busiest minute in this window: {formatInt(peakRpm)} requests
            {limits.rpm ? ` (limit ${formatInt(limits.rpm)}/min)` : ""} and {formatInt(peakTpm)}{" "}
            tokens{limits.tpm ? ` (limit ${formatInt(limits.tpm)}/min)` : ""}. Per-minute limits are
            the ones a burst actually hits; daily limits only matter for batch jobs like evals.
          </>
        )}
      </p>
    </section>
  );
}
