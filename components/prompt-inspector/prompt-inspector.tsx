"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Play, RotateCcw, Square } from "lucide-react";

import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { isAbortError, streamChat } from "@/lib/chat/client";
import { allChatModels } from "@/lib/config";
import type { RunSummary } from "@/lib/db/runs";
import { formatInt, formatMs, formatUsd } from "@/lib/format";
import type { Usage } from "@/lib/llm/types";
import { rebuildMessages, type PromptPart, type SplitPrompt } from "@/lib/prompt/anatomy";
import { cn } from "@/lib/utils";

import { kindStyle, TokenBudget } from "./token-budget";

type Props = {
  run: RunSummary;
  split: SplitPrompt;
  parts: PromptPart[];
  /** Chunks this run had but left out (it was itself a re-run). */
  removed: { label: string; rank: number; score: number }[];
  reruns: RunSummary[];
};

type Rerun = {
  runId?: string;
  model: string;
  status: "streaming" | "ok" | "stopped" | "error";
  answer: string;
  usage: Usage | null;
  ttftMs: number | null;
  totalMs: number | null;
  estCostUsd: number | null;
  removedCount: number;
  systemEdited: boolean;
  error?: string;
};

const label = (id: string) => allChatModels.find((m) => m.id === id)?.label ?? id;

export function PromptInspector({ run, split, parts, removed, reruns }: Props) {
  const originalSystem = split.system ?? "";
  const [system, setSystem] = useState(originalSystem);
  const [model, setModel] = useState(run.model);
  const [dropped, setDropped] = useState<Set<number>>(new Set());
  const [current, setCurrent] = useState<Rerun | null>(null);
  const [history, setHistory] = useState<Rerun[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const streaming = current?.status === "streaming";
  const sources = split.rag?.sources ?? [];
  const droppedTokens = parts
    .filter((p) => p.source && dropped.has(p.source.n))
    .reduce((s, p) => s + p.tokens, 0);

  function toggle(n: number, keep: boolean) {
    setDropped((prev) => {
      const next = new Set(prev);
      if (keep) next.delete(n);
      else next.add(n);
      return next;
    });
  }

  async function rerun() {
    if (streaming) return;
    const messages = rebuildMessages(split, { system, keep: (n) => !dropped.has(n) });
    const fresh: Rerun = {
      model,
      status: "streaming",
      answer: "",
      usage: null,
      ttftMs: null,
      totalMs: null,
      estCostUsd: null,
      removedCount: dropped.size,
      systemEdited: system !== originalSystem,
    };
    if (current && current.status !== "streaming") setHistory((h) => [current, ...h]);
    setCurrent(fresh);
    const patch = (p: Partial<Rerun>) => setCurrent((r) => (r ? { ...r, ...p } : r));

    const controller = new AbortController();
    abortRef.current = controller;
    const start = performance.now();
    try {
      await streamChat(
        {
          model,
          messages,
          mode: "raw",
          source: "inspector",
          parentRunId: run.id,
          question: split.rag?.question ?? run.question,
          temperature: run.temperature,
          // Record which chunks were kept, so this re-run can be inspected too.
          chunks: sources
            .filter((s) => s.chunkId)
            .map((s) => ({
              chunkId: s.chunkId!,
              rank: s.n,
              score: s.score ?? 0,
              usedInPrompt: !dropped.has(s.n),
            })),
        },
        {
          signal: controller.signal,
          onEvent: (e, clientMs) => {
            switch (e.event) {
              case "start":
                return patch({ runId: e.data.runId });
              case "token":
                return setCurrent((r) =>
                  r ? { ...r, answer: r.answer + e.data.text, ttftMs: r.ttftMs ?? clientMs } : r,
                );
              case "usage":
                return patch({ usage: e.data });
              case "done":
                return patch({
                  status: e.data.status,
                  totalMs: clientMs,
                  usage: e.data.usage,
                  estCostUsd: e.data.estCostUsd,
                });
              case "error":
                return patch({ status: "error", totalMs: clientMs, error: e.data.message });
            }
          },
        },
      );
    } catch (err) {
      const totalMs = Math.round(performance.now() - start);
      if (isAbortError(err)) patch({ status: "stopped", totalMs });
      else patch({ status: "error", totalMs, error: String(err) });
    } finally {
      abortRef.current = null;
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">Prompt inspector</h1>
        <p className="text-muted-foreground text-sm">
          The exact messages this run sent, part by part, with what each part cost in tokens. Edit
          the rules or drop a source, then re-run to compare the answers.
        </p>
        <div className="bg-muted/40 flex flex-col gap-1 rounded-lg border p-3 text-sm">
          <div className="line-clamp-3 font-medium" title={run.question}>
            {split.rag?.question ?? run.question}
          </div>
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs">
            <span>{label(run.model)}</span>
            <Badge variant={run.status === "ok" ? "secondary" : "outline"}>{run.status}</Badge>
            <span>
              {run.mode === "rag"
                ? `RAG, top ${run.topK}`
                : split.rag
                  ? // A re-run sends its edited prompt raw, sources already inside.
                    `${sources.length} sources, no new retrieval`
                  : "no retrieval"}
            </span>
            <span>{run.source}</span>
            <span>TTFT {formatMs(run.ttftMs)}</span>
            <span>total {formatMs(run.totalMs)}</span>
            <span>cost if paid {formatUsd(run.estCostUsd)}</span>
            <Link href={`/runs/${run.id}/stream`} className="underline underline-offset-2">
              Stream debugger
            </Link>
            <Link href={`/ledger?run=${run.id}`} className="underline underline-offset-2">
              In the ledger
            </Link>
            {run.parentRunId && (
              <Link
                href={`/runs/${run.parentRunId}/prompt`}
                className="underline underline-offset-2"
              >
                Re-run of an earlier run
              </Link>
            )}
          </div>
          {run.error && <div className="text-destructive text-xs">{run.error}</div>}
        </div>
      </header>

      <TokenBudget run={run} parts={parts} />

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Messages as sent</h2>
        {split.rag && !split.rag.matchedChunks && sources.length > 0 && (
          <p className="text-muted-foreground text-xs">
            This run&apos;s chunks are no longer in the database (the document was deleted or
            re-uploaded), so the sources below were read back out of the saved prompt text.
          </p>
        )}
        {removed.length > 0 && (
          <p className="text-muted-foreground text-xs">
            Left out of this re-run: {removed.map((r) => r.label).join(", ")}.
          </p>
        )}
        <div className="flex flex-col gap-3">
          {parts.map((part) => (
            <PartCard
              key={part.id}
              part={part}
              dropped={part.source ? dropped.has(part.source.n) : false}
              onToggle={part.source ? (keep) => toggle(part.source!.n, keep) : undefined}
              disabled={streaming}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Edit and re-run</h2>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="system">System prompt</Label>
            {system !== originalSystem && (
              <Button variant="ghost" size="sm" onClick={() => setSystem(originalSystem)}>
                <RotateCcw /> Reset
              </Button>
            )}
          </div>
          <Textarea
            id="system"
            value={system}
            onChange={(e) => setSystem(e.target.value)}
            className="min-h-32 font-mono text-xs"
            disabled={streaming}
            placeholder="(No system prompt. Leave empty to send none.)"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <NativeSelect
            value={model}
            onChange={(e) => setModel(e.target.value)}
            aria-label="Model to re-run on"
            disabled={streaming}
          >
            {allChatModels.map((m) => (
              <NativeSelectOption key={m.id} value={m.id}>
                {m.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {sources.length > 0 && (
            <span className="text-muted-foreground text-sm">
              {dropped.size > 0
                ? `Dropping ${dropped.size} of ${sources.length} sources (≈${formatInt(droppedTokens)} tokens fewer)`
                : `All ${sources.length} sources kept`}
            </span>
          )}
          {streaming ? (
            <Button variant="outline" className="ml-auto" onClick={() => abortRef.current?.abort()}>
              <Square className="fill-current" /> Stop
            </Button>
          ) : (
            <Button className="ml-auto" onClick={() => void rerun()}>
              <Play /> Re-run
            </Button>
          )}
        </div>

        {current && (
          <div className="grid gap-4 md:grid-cols-2">
            <AnswerColumn
              title="Original"
              subtitle={label(run.model)}
              answer={run.answer}
              stats={{
                input: run.inputTokens,
                output: run.outputTokens,
                ttftMs: run.ttftMs,
                totalMs: run.totalMs,
                cost: run.estCostUsd,
              }}
            />
            <AnswerColumn
              title="Re-run"
              subtitle={describe(current)}
              answer={current.answer}
              streaming={current.status === "streaming"}
              error={current.error}
              stats={{
                input: current.usage?.inputTokens ?? null,
                output: current.usage?.outputTokens ?? null,
                ttftMs: current.ttftMs,
                totalMs: current.totalMs,
                cost: current.estCostUsd,
              }}
              baseline={{ input: run.inputTokens, cost: run.estCostUsd }}
              runId={current.status === "streaming" ? undefined : current.runId}
            />
          </div>
        )}
      </section>

      {(history.length > 0 || reruns.length > 0) && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">Earlier re-runs of this run</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-left text-xs">
                <tr>
                  <th className="py-1 font-normal">Model</th>
                  <th className="py-1 text-right font-normal">Input</th>
                  <th className="py-1 text-right font-normal">Output</th>
                  <th className="py-1 text-right font-normal">Cost if paid</th>
                  <th className="py-1 font-normal" />
                </tr>
              </thead>
              <tbody className="font-mono text-xs">
                {[
                  ...history.map((h, i) => ({
                    // A re-run that failed before "start" has no id yet.
                    key: h.runId ?? `session-${history.length - i}`,
                    id: h.runId,
                    model: describe(h),
                    input: h.usage?.inputTokens ?? null,
                    output: h.usage?.outputTokens ?? null,
                    cost: h.estCostUsd,
                  })),
                  ...reruns
                    .filter((r) => !history.some((h) => h.runId === r.id))
                    .reverse()
                    .map((r) => ({
                      key: r.id,
                      id: r.id,
                      model: label(r.model),
                      input: r.inputTokens,
                      output: r.outputTokens,
                      cost: r.estCostUsd,
                    })),
                ].map((r) => (
                  <tr key={r.key} className="border-t">
                    <td className="py-1.5 font-sans">{r.model}</td>
                    <td className="text-right">{formatInt(r.input)}</td>
                    <td className="text-right">{formatInt(r.output)}</td>
                    <td className="text-right">{formatUsd(r.cost)}</td>
                    <td className="pl-4 font-sans">
                      {r.id && (
                        <Link
                          href={`/runs/${r.id}/prompt`}
                          className="underline underline-offset-2"
                        >
                          Inspect
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function describe(r: Rerun): string {
  const changes = [
    r.systemEdited && "edited rules",
    r.removedCount > 0 && `${r.removedCount} source${r.removedCount > 1 ? "s" : ""} dropped`,
  ].filter(Boolean);
  return `${label(r.model)}${changes.length ? `, ${changes.join(", ")}` : ""}`;
}

function PartCard({
  part,
  dropped,
  onToggle,
  disabled,
}: {
  part: PromptPart;
  dropped: boolean;
  onToggle?: (keep: boolean) => void;
  disabled: boolean;
}) {
  const style = kindStyle[part.kind];
  const header = (
    <div className="flex items-center gap-2 px-3 py-2 text-xs">
      <span className={cn("inline-block size-2.5 shrink-0 rounded-sm", style.dot)} />
      <span className="truncate font-medium">{part.label}</span>
      {part.source?.score != null && (
        <span className="text-muted-foreground font-mono">
          score {part.source.score.toFixed(3)}
        </span>
      )}
      <span className="text-muted-foreground ml-auto shrink-0 font-mono">
        ≈{formatInt(part.tokens)} tokens
      </span>
      {onToggle && (
        <span
          className="flex shrink-0 items-center gap-1.5"
          // Toggling shouldn't also open or close the <details> around it.
          onClick={(e) => e.stopPropagation()}
        >
          <Switch
            checked={!dropped}
            onCheckedChange={onToggle}
            disabled={disabled}
            aria-label={`Include ${part.label} in the re-run`}
          />
        </span>
      )}
    </div>
  );
  const body = (
    <pre className="text-muted-foreground max-h-72 overflow-auto border-t px-3 py-2 text-xs whitespace-pre-wrap">
      {part.text}
    </pre>
  );

  // Sources are long, so they start collapsed; everything else is open.
  if (part.kind === "source") {
    return (
      <details className={cn("rounded-md border", dropped && "opacity-50")}>
        <summary className="cursor-pointer list-none">{header}</summary>
        {body}
      </details>
    );
  }
  return (
    <div className="rounded-md border">
      {header}
      {body}
    </div>
  );
}

function AnswerColumn({
  title,
  subtitle,
  answer,
  stats,
  baseline,
  streaming,
  error,
  runId,
}: {
  title: string;
  subtitle: string;
  answer: string;
  stats: {
    input: number | null;
    output: number | null;
    ttftMs: number | null;
    totalMs: number | null;
    cost: number | null;
  };
  baseline?: { input: number | null; cost: number | null };
  streaming?: boolean;
  error?: string;
  runId?: string;
}) {
  const inputDelta =
    baseline?.input != null && stats.input != null ? stats.input - baseline.input : null;
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-lg border p-4">
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-muted-foreground text-xs">{subtitle}</div>
      </div>
      <div className="min-h-16 leading-relaxed">
        <Markdown text={answer} />
        {streaming && (
          <span className="bg-foreground ml-0.5 inline-block h-4 w-1.5 animate-pulse align-middle" />
        )}
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
      <div className="text-muted-foreground mt-auto flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs">
        <span>
          in <span className="text-foreground">{formatInt(stats.input)}</span>
          {inputDelta != null && inputDelta !== 0 && (
            <span className={inputDelta < 0 ? "text-emerald-600" : "text-amber-600"}>
              {" "}
              ({inputDelta > 0 ? "+" : ""}
              {formatInt(inputDelta)})
            </span>
          )}
        </span>
        <span>
          out <span className="text-foreground">{formatInt(stats.output)}</span>
        </span>
        <span>TTFT {formatMs(stats.ttftMs)}</span>
        <span>total {formatMs(stats.totalMs)}</span>
        <span>
          cost if paid <span className="text-foreground">{formatUsd(stats.cost)}</span>
        </span>
        {runId && (
          <Link href={`/runs/${runId}/prompt`} className="font-sans underline underline-offset-2">
            Inspect re-run
          </Link>
        )}
      </div>
    </div>
  );
}
