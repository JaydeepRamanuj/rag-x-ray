"use client";

import { useState } from "react";
import { Hash } from "lucide-react";

import { Button } from "@/components/ui/button";
import { allChatModels, estimateCostUsd } from "@/lib/config";
import type { RunSummary } from "@/lib/db/runs";
import { formatInt, formatUsd } from "@/lib/format";
import type { PartKind, PromptPart } from "@/lib/prompt/anatomy";
import { cn } from "@/lib/utils";

export const kindStyle: Record<PartKind, { label: string; bar: string; dot: string }> = {
  system: { label: "System prompt", bar: "bg-violet-500", dot: "bg-violet-500" },
  history: { label: "History", bar: "bg-sky-500", dot: "bg-sky-500" },
  framing: { label: "Framing", bar: "bg-zinc-400", dot: "bg-zinc-400" },
  // Sources alternate shades (see below) so neighbouring chunks stay distinct.
  source: { label: "Sources", bar: "bg-amber-500", dot: "bg-amber-500" },
  question: { label: "Question", bar: "bg-emerald-500", dot: "bg-emerald-500" },
  message: { label: "User message", bar: "bg-emerald-500", dot: "bg-emerald-500" },
};

const KIND_ORDER: PartKind[] = ["system", "history", "framing", "source", "question", "message"];

type Counts = { counts: number[]; exact: boolean; method: string };

export function TokenBudget({ run, parts }: { run: RunSummary; parts: PromptPart[] }) {
  const [provider, setProvider] = useState<Counts | null>(null);
  const [counting, setCounting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const estimate = parts.reduce((s, p) => s + p.tokens, 0);
  const exact = run.inputTokens;
  // Positive: the chat template's role markers and the provider's tokenizer
  // add tokens our per-part o200k estimate doesn't see.
  const gap = exact != null ? exact - estimate : null;
  const barTotal = Math.max(estimate, exact ?? 0);

  const model = allChatModels.find((m) => m.id === run.model);
  const price = model?.price ?? null;
  const inputUsd =
    price && exact != null
      ? estimateCostUsd(price, {
          inputTokens: exact,
          cachedTokens: run.cachedTokens ?? 0,
          outputTokens: 0,
        })
      : null;
  const outputUsd =
    price && run.outputTokens != null
      ? estimateCostUsd(price, { inputTokens: 0, outputTokens: run.outputTokens })
      : null;

  const byKind = KIND_ORDER.map((kind) => {
    const ofKind = parts.filter((p) => p.kind === kind);
    return {
      kind,
      count: ofKind.length,
      tokens: ofKind.reduce((s, p) => s + p.tokens, 0),
      provider: provider
        ? parts.reduce((s, p, i) => s + (p.kind === kind ? provider.counts[i] : 0), 0)
        : null,
    };
  }).filter((k) => k.count > 0);

  async function countWithProvider() {
    setCounting(true);
    setError(null);
    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: run.model, texts: parts.map((p) => p.text) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Request failed with ${res.status}`);
      setProvider(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCounting(false);
    }
  }

  const sourceIds = parts.filter((p) => p.kind === "source").map((p) => p.id);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Token budget</h2>
        <Button variant="outline" size="sm" onClick={countWithProvider} disabled={counting}>
          <Hash /> {counting ? "Counting…" : `Count with ${model?.label ?? run.model}'s tokenizer`}
        </Button>
      </div>

      {/* One segment per part, in the order the model reads them. */}
      <div className="bg-muted flex h-6 w-full overflow-hidden rounded-md">
        {parts.map((p) => {
          const shade =
            p.kind === "source"
              ? sourceIds.indexOf(p.id) % 2
                ? "bg-amber-400"
                : "bg-amber-600"
              : null;
          return (
            <div
              key={p.id}
              title={`${p.label}: ~${formatInt(p.tokens)} tokens`}
              className={cn(
                "h-full border-r border-white/40 last:border-r-0",
                shade ?? kindStyle[p.kind].bar,
              )}
              style={{ width: `${(p.tokens / barTotal) * 100}%` }}
            />
          );
        })}
        {gap != null && gap > 0 && (
          <div
            title={`Template and tokenizer gap: ${formatInt(gap)} tokens`}
            className="h-full bg-[repeating-linear-gradient(45deg,var(--color-muted-foreground)_0_2px,transparent_2px_6px)] opacity-40"
            style={{ width: `${(gap / barTotal) * 100}%` }}
          />
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground text-left text-xs">
            <tr>
              <th className="py-1 font-normal">Part</th>
              <th className="py-1 text-right font-normal">Estimate (o200k)</th>
              <th className="py-1 text-right font-normal">Share</th>
              {provider && (
                <th className="py-1 text-right font-normal" title={provider.method}>
                  {provider.exact ? "Provider count" : "Provider tokenizer"}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="font-mono text-xs">
            {byKind.map((k) => (
              <tr key={k.kind} className="border-t">
                <td className="py-1.5 font-sans text-sm">
                  <span
                    className={cn("mr-2 inline-block size-2.5 rounded-sm", kindStyle[k.kind].dot)}
                  />
                  {kindStyle[k.kind].label}
                  {k.count > 1 && <span className="text-muted-foreground"> ×{k.count}</span>}
                </td>
                <td className="text-right">{formatInt(k.tokens)}</td>
                <td className="text-right">
                  {estimate ? `${Math.round((k.tokens / estimate) * 100)}%` : "–"}
                </td>
                {provider && <td className="text-right">{formatInt(k.provider)}</td>}
              </tr>
            ))}
            <tr className="border-t font-semibold">
              <td className="py-1.5 font-sans text-sm">Sum of parts</td>
              <td className="text-right">{formatInt(estimate)}</td>
              <td />
              {provider && (
                <td className="text-right">
                  {formatInt(provider.counts.reduce((s, n) => s + n, 0))}
                </td>
              )}
            </tr>
            <tr className="border-t">
              <td className="py-1.5 font-sans text-sm">
                <span className="mr-2 inline-block size-2.5 rounded-sm bg-[repeating-linear-gradient(45deg,var(--color-muted-foreground)_0_2px,transparent_2px_4px)] opacity-60" />
                Billed by the provider
              </td>
              <td className="text-right">{formatInt(exact)}</td>
              <td className="text-muted-foreground text-right font-sans" colSpan={provider ? 2 : 1}>
                {gap != null && `${gap >= 0 ? "+" : ""}${formatInt(gap)} vs estimate`}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-muted-foreground text-xs leading-relaxed">
        Part counts are local estimates with OpenAI&apos;s o200k vocabulary. The provider&apos;s
        number is exact and is what you&apos;re billed for. The gap is the chat template (role
        markers wrapped around every message) plus the provider&apos;s own tokenizer counting the
        same text differently. Gemini, for example, splits numbers into single digits.
        {provider &&
          ` The provider column counts each part as its own message (${provider.method}), so it carries a little per-message overhead too.`}
      </p>
      {error && <p className="text-destructive text-xs">{error}</p>}

      <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs">
        <span>
          input <span className="text-foreground">{formatInt(exact)}</span>
          {run.cachedTokens ? ` (${formatInt(run.cachedTokens)} cached)` : ""} →{" "}
          <span className="text-foreground">{formatUsd(inputUsd)}</span>
        </span>
        <span>
          output <span className="text-foreground">{formatInt(run.outputTokens)}</span>
          {run.reasoningTokens ? ` (${formatInt(run.reasoningTokens)} thinking)` : ""} →{" "}
          <span className="text-foreground">{formatUsd(outputUsd)}</span>
        </span>
        {model?.contextWindow && exact != null && (
          <span>
            {((exact / model.contextWindow) * 100).toFixed(2)}% of the{" "}
            {formatInt(model.contextWindow)}-token context window
          </span>
        )}
      </div>
    </section>
  );
}
