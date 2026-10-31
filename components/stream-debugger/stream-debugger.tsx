"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Play, Square } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { isAbortError, streamChat } from "@/lib/chat/client";
import type { ChatEvent } from "@/lib/chat/events";
import { allChatModels } from "@/lib/config";
import { formatInt, formatMs, formatUsd } from "@/lib/format";
import type { ChatMessage, Usage } from "@/lib/llm/types";

export type SavedRun = {
  id: string;
  question: string;
  answer: string;
  status: string;
  error: string | null;
  model: string;
  messages: ChatMessage[];
  inputTokens: number | null;
  outputTokens: number | null;
  ttftMs: number | null;
  totalMs: number | null;
  estCostUsd: number | null;
  createdAt: string | null;
};

type LogRow =
  | { kind: "read"; atMs: number; n: number; bytes: number; events: number; pending: number }
  | { kind: "event"; atMs: number; event: string; data: string };

/** Client-side timestamps (ms since the request was sent). */
type Marks = { headers?: number; firstToken?: number; lastToken?: number; end?: number };

type Replay = {
  n: number;
  model: string;
  slow: boolean;
  status: "streaming" | "ok" | "stopped" | "error";
  marks: Marks;
  usage: Usage | null;
  reads: number;
  retries: number;
  headers: Record<string, string>;
  cost: number | null;
  error?: string;
};

const SLOW_READ_MS = 250;

function label(modelId: string) {
  return allChatModels.find((m) => m.id === modelId)?.label ?? modelId;
}

/**
 * Tokens per second over the generation window (first to last token), not
 * the whole request, so queueing and thinking time don't drag it down.
 * Thinking tokens are produced before the first visible token, so they're
 * excluded from the count too.
 */
function tokensPerSecond(r: Replay): number | null {
  const { firstToken, lastToken } = r.marks;
  if (!r.usage || firstToken == null || lastToken == null || lastToken <= firstToken) return null;
  const visible = r.usage.outputTokens - r.usage.reasoningTokens;
  return visible / ((lastToken - firstToken) / 1000);
}

export function StreamDebugger({ run }: { run: SavedRun }) {
  const [model, setModel] = useState(run.model);
  const [slow, setSlow] = useState(false);
  const [log, setLog] = useState<LogRow[]>([]);
  const [text, setText] = useState<string | null>(null);
  const [replays, setReplays] = useState<Replay[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const current = replays.at(-1);
  const streaming = current?.status === "streaming";

  function patch(fn: (r: Replay) => Replay) {
    setReplays((prev) => [...prev.slice(0, -1), fn(prev.at(-1)!)]);
  }
  function mark(key: keyof Marks, ms: number, onlyFirst = false) {
    patch((r) =>
      onlyFirst && r.marks[key] != null ? r : { ...r, marks: { ...r.marks, [key]: ms } },
    );
  }

  function onEvent(e: ChatEvent, ms: number) {
    // Tokens are shown on the right; logging each one would bury the
    // interesting events, so the log keeps upstream frames and control events.
    if (e.event !== "token") {
      setLog((prev) => [
        ...prev,
        {
          kind: "event",
          atMs: ms,
          event: e.event,
          // An upstream frame is already a JSON string; show it as the
          // provider sent it rather than escaped inside our envelope.
          data: e.event === "upstream" ? e.data.data : JSON.stringify(e.data),
        },
      ]);
    }
    switch (e.event) {
      case "retry":
        return patch((r) => ({ ...r, retries: r.retries + 1 }));
      case "meta":
        mark("headers", ms);
        return patch((r) => ({ ...r, headers: e.data.headers }));
      case "token":
        setText((t) => (t ?? "") + e.data.text);
        mark("firstToken", ms, true);
        return mark("lastToken", ms);
      case "usage":
        return patch((r) => ({ ...r, usage: e.data }));
      case "done":
        return patch((r) => ({
          ...r,
          status: e.data.status,
          usage: e.data.usage,
          cost: e.data.estCostUsd,
          marks: { ...r.marks, end: ms },
        }));
      case "error":
        return patch((r) => ({
          ...r,
          status: "error",
          error: e.data.message,
          marks: { ...r.marks, end: ms },
        }));
    }
  }

  async function replay() {
    const controller = new AbortController();
    abortRef.current = controller;
    setLog([]);
    setText("");
    setReplays((prev) => [
      ...prev,
      {
        n: prev.length + 1,
        model,
        slow,
        status: "streaming",
        marks: {},
        usage: null,
        reads: 0,
        retries: 0,
        headers: {},
        cost: null,
      },
    ]);
    const start = performance.now();

    try {
      await streamChat(
        { model, messages: run.messages, debug: true, source: "debugger" },
        {
          signal: controller.signal,
          slowReadMs: slow ? SLOW_READ_MS : 0,
          onRead: (info, ms) => {
            patch((r) => ({ ...r, reads: r.reads + 1 }));
            setLog((prev) => [
              ...prev,
              {
                kind: "read",
                atMs: ms,
                n: prev.filter((row) => row.kind === "read").length + 1,
                bytes: info.bytes,
                events: info.events,
                pending: info.pendingChars,
              },
            ]);
          },
          onEvent,
        },
      );
    } catch (err) {
      const end = Math.round(performance.now() - start);
      patch((r) => ({
        ...r,
        status: isAbortError(err) ? "stopped" : "error",
        error: isAbortError(err) ? undefined : String(err),
        marks: { ...r.marks, end },
      }));
    } finally {
      abortRef.current = null;
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">Streaming debugger</h1>
        <p className="text-muted-foreground text-sm">
          Replay this run&apos;s exact prompt and watch the wire: every network read, every SSE
          event, and the raw frames from the provider underneath.
        </p>
        <div className="bg-muted/40 flex flex-col gap-1 rounded-lg border p-3 text-sm">
          <div className="font-medium">{run.question}</div>
          <div className="text-muted-foreground flex flex-wrap gap-x-4 font-mono text-xs">
            <span>saved run</span>
            <span>{label(run.model)}</span>
            <span>
              status{" "}
              <Badge variant={run.status === "ok" ? "secondary" : "outline"}>{run.status}</Badge>
            </span>
            <span>TTFT {formatMs(run.ttftMs)}</span>
            <span>total {formatMs(run.totalMs)}</span>
            <span>in {formatInt(run.inputTokens)}</span>
            <span>out {formatInt(run.outputTokens)}</span>
            <span>cost if paid {formatUsd(run.estCostUsd)}</span>
            <Link
              href={`/runs/${run.id}/prompt`}
              className="font-sans underline underline-offset-2"
            >
              Prompt inspector
            </Link>
          </div>
          {run.error && <div className="text-destructive text-xs">{run.error}</div>}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-4">
        <NativeSelect
          value={model}
          onChange={(e) => setModel(e.target.value)}
          aria-label="Model to replay on"
          disabled={streaming}
        >
          {allChatModels.map((m) => (
            <NativeSelectOption key={m.id} value={m.id}>
              {m.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <div className="flex items-center gap-2">
          <Switch id="slow" checked={slow} onCheckedChange={setSlow} disabled={streaming} />
          <Label htmlFor="slow">Slow network ({SLOW_READ_MS} ms per read)</Label>
        </div>
        {streaming ? (
          <Button variant="outline" onClick={() => abortRef.current?.abort()}>
            <Square className="fill-current" /> Stop
          </Button>
        ) : (
          <Button onClick={() => void replay()}>
            <Play /> Replay
          </Button>
        )}
        <span className="text-muted-foreground text-xs">
          Each replay is a real request and is saved as a new run.
        </span>
      </div>

      {current && <Timeline replay={current} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-2">
          <h2 className="text-sm font-medium">Wire log</h2>
          <div className="bg-muted/30 h-[28rem] overflow-auto rounded-lg border p-2 font-mono text-[11px] leading-5">
            {log.length === 0 ? (
              <p className="text-muted-foreground p-2">
                Events aren&apos;t stored with the run. Press Replay to capture them.
              </p>
            ) : (
              log.map((row, i) => <LogLine key={i} row={row} />)
            )}
          </div>
        </section>
        <section className="flex min-w-0 flex-col gap-2">
          <h2 className="text-sm font-medium">
            {text === null ? "Saved answer" : "Rendered text"}
          </h2>
          <div className="h-[28rem] overflow-auto rounded-lg border p-4 text-sm leading-relaxed whitespace-pre-wrap">
            {text ?? run.answer}
          </div>
        </section>
      </div>

      {current && Object.keys(current.headers).length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">Upstream response headers</h2>
          <div className="text-muted-foreground grid gap-x-6 font-mono text-xs sm:grid-cols-2">
            {Object.entries(current.headers).map(([k, v]) => (
              <div key={k}>
                {k}: <span className="text-foreground">{v}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {replays.length > 0 && <CompareTable replays={replays} />}
    </div>
  );
}

function LogLine({ row }: { row: LogRow }) {
  const t = (
    <span className="text-muted-foreground inline-block w-16 text-right">{row.atMs} ms</span>
  );
  if (row.kind === "read") {
    return (
      <div className="mt-1 border-t border-dashed pt-1 text-sky-700 dark:text-sky-400">
        {t} read #{row.n}: {row.bytes} bytes → {row.events} event{row.events === 1 ? "" : "s"}
        {row.pending > 0 && `, ${row.pending} chars waiting for the rest of an event`}
      </div>
    );
  }
  const upstream = row.event === "upstream";
  return (
    <div className={upstream ? "text-muted-foreground truncate pl-4" : "truncate"} title={row.data}>
      {t} <span className={upstream ? "" : "font-semibold"}>{row.event}</span> {row.data}
    </div>
  );
}

function Timeline({ replay }: { replay: Replay }) {
  const { marks } = replay;
  const end = marks.end ?? marks.lastToken ?? marks.headers ?? 1;
  const points: [string, number | undefined, string][] = [
    ["sent", 0, "bg-foreground"],
    ["headers", marks.headers, "bg-sky-500"],
    ["first token", marks.firstToken, "bg-emerald-500"],
    ["last token", marks.lastToken, "bg-amber-500"],
    ["end", marks.end, "bg-foreground"],
  ];
  const tps = tokensPerSecond(replay);

  return (
    <section className="flex flex-col gap-3">
      <div className="text-muted-foreground flex flex-wrap gap-x-5 font-mono text-xs">
        <span>
          TTFT <span className="text-foreground">{formatMs(marks.firstToken)}</span>
        </span>
        <span>
          tokens/s <span className="text-foreground">{tps == null ? "–" : tps.toFixed(0)}</span>
        </span>
        <span>
          total <span className="text-foreground">{formatMs(marks.end)}</span>
        </span>
        <span>
          reads <span className="text-foreground">{replay.reads}</span>
        </span>
        <span>
          out tokens{" "}
          <span className="text-foreground">{formatInt(replay.usage?.outputTokens)}</span>
          {replay.usage?.reasoningTokens ? ` (${replay.usage.reasoningTokens} thinking)` : ""}
        </span>
        {replay.retries > 0 && <span className="text-amber-600">{replay.retries} retries</span>}
        <span>{replay.status}</span>
      </div>
      <div className="relative h-8">
        <div className="bg-muted absolute top-3 right-0 left-0 h-2 rounded-full" />
        {marks.firstToken != null && marks.lastToken != null && (
          <div
            className="absolute top-3 h-2 rounded-full bg-emerald-500/40"
            style={{
              left: `${(marks.firstToken / end) * 100}%`,
              width: `${((marks.lastToken - marks.firstToken) / end) * 100}%`,
            }}
          />
        )}
        {points.map(([name, at, color]) =>
          at == null ? null : (
            <div
              key={name}
              className={`absolute top-1.5 size-5 -translate-x-1/2 rounded-full border-2 border-white ${color}`}
              style={{ left: `${(at / end) * 100}%` }}
              title={`${name}: ${at} ms`}
            />
          ),
        )}
      </div>
      <div className="text-muted-foreground flex flex-wrap gap-x-4 text-xs">
        {points.map(([name, at, color]) => (
          <span key={name} className="flex items-center gap-1">
            <span className={`size-2 rounded-full ${color}`} /> {name}{" "}
            {at == null ? "–" : `${at} ms`}
          </span>
        ))}
      </div>
    </section>
  );
}

function CompareTable({ replays }: { replays: Replay[] }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium">Replays this session</h2>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full font-mono text-xs">
          <thead className="bg-muted/50 text-muted-foreground text-left">
            <tr>
              {[
                "#",
                "model",
                "network",
                "TTFT",
                "tokens/s",
                "total",
                "out",
                "reads",
                "cost if paid",
                "status",
              ].map((h) => (
                <th key={h} className="px-3 py-2 font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {replays.map((r) => {
              const tps = tokensPerSecond(r);
              return (
                <tr key={r.n} className="border-t">
                  <td className="px-3 py-2">{r.n}</td>
                  <td className="px-3 py-2">{label(r.model)}</td>
                  <td className="px-3 py-2">{r.slow ? "slow" : "normal"}</td>
                  <td className="px-3 py-2">{formatMs(r.marks.firstToken)}</td>
                  <td className="px-3 py-2">{tps == null ? "–" : tps.toFixed(0)}</td>
                  <td className="px-3 py-2">{formatMs(r.marks.end)}</td>
                  <td className="px-3 py-2">{formatInt(r.usage?.outputTokens)}</td>
                  <td className="px-3 py-2">{r.reads}</td>
                  <td className="px-3 py-2">{formatUsd(r.cost)}</td>
                  <td className="px-3 py-2">{r.error ?? r.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
