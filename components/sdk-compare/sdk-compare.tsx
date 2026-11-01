"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { SourceSide } from "@/lib/compare/sources";
import { allChatModels } from "@/lib/config";
import { formatInt, formatMs } from "@/lib/format";
import { readSse } from "@/lib/sse/parser";

type Frame = { atMs: number; event: string; data: string };

type Lane = {
  frames: Frame[];
  bytes: number;
  text: string;
  ttftMs: number | null;
  totalMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  runId: string | null;
  error: string | null;
};

const ROUTES = [
  { key: "hand", label: "Hand-rolled", url: "/api/chat", extra: { mode: "rag", source: "chat" } },
  { key: "sdk", label: "Vercel AI SDK", url: "/api/chat-sdk", extra: {} },
] as const;

function emptyLane(): Lane {
  return {
    frames: [],
    bytes: 0,
    text: "",
    ttftMs: null,
    totalMs: null,
    inputTokens: null,
    outputTokens: null,
    runId: null,
    error: null,
  };
}

/**
 * Reads either route's stream with the same hand-written parser and pulls
 * the text and totals out of each protocol's own event names. Times are
 * measured here, in the browser, so both lanes are timed the same way.
 */
async function race(
  route: (typeof ROUTES)[number],
  body: object,
  update: (fn: (l: Lane) => Lane) => void,
) {
  const t0 = performance.now();
  const since = () => Math.round(performance.now() - t0);
  try {
    const res = await fetch(route.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, ...route.extra }),
    });
    if (!res.ok || !res.body) throw new Error((await res.text()) || res.statusText);
    for await (const e of readSse(res.body, (info) =>
      update((l) => ({ ...l, bytes: l.bytes + info.bytes })),
    )) {
      const atMs = since();
      update((l) => {
        const next = { ...l, frames: [...l.frames, { atMs, event: e.event, data: e.data }] };
        if (e.data === "[DONE]") return next;
        const json = JSON.parse(e.data);
        if (route.key === "hand") {
          // Named events: `event: token` with { text }, `event: done` with totals.
          if (e.event === "start") next.runId = json.runId;
          if (e.event === "token") {
            next.ttftMs ??= atMs;
            next.text += json.text;
          }
          if (e.event === "done") {
            next.inputTokens = json.usage?.inputTokens ?? null;
            next.outputTokens = json.usage?.outputTokens ?? null;
          }
          if (e.event === "error") next.error = json.message;
        } else {
          // Unnamed events, each a JSON part with its own `type`.
          if (json.type === "data-run") next.runId = json.data.runId;
          if (json.type === "text-delta" && json.delta) {
            next.ttftMs ??= atMs;
            next.text += json.delta;
          }
          if (json.type === "finish") {
            next.inputTokens = json.messageMetadata?.usage?.inputTokens ?? null;
            next.outputTokens = json.messageMetadata?.usage?.outputTokens ?? null;
          }
          if (json.type === "error") next.error = json.errorText;
        }
        return next;
      });
    }
    update((l) => ({ ...l, totalMs: since() }));
  } catch (err) {
    update((l) => ({ ...l, error: err instanceof Error ? err.message : String(err) }));
  }
}

export function SdkCompare({ sides }: { sides: SourceSide[] }) {
  const [question, setQuestion] = useState("How does Reciprocal Rank Fusion merge two lists?");
  const [model, setModel] = useState(allChatModels[0].id);
  const [lanes, setLanes] = useState<Record<string, Lane> | null>(null);
  const [running, setRunning] = useState(false);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setRunning(true);
    setLanes({ hand: emptyLane(), sdk: emptyLane() });
    const body = { model, messages: [{ role: "user", content: question.trim() }], topK: 5 };
    // Both at once, so they meet the same provider load. Retrieval for the
    // same question is cached after the first call, so a second race is fairer.
    await Promise.all(
      ROUTES.map((r) =>
        race(r, body, (fn) => setLanes((all) => (all ? { ...all, [r.key]: fn(all[r.key]) } : all))),
      ),
    );
    setRunning(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 lg:grid-cols-2">
        {sides.map((side) => (
          <CodeSide key={side.label} side={side} />
        ))}
      </section>

      <section className="flex flex-col gap-4 rounded-lg border p-4">
        <header className="flex flex-col gap-1">
          <h2 className="font-medium">Race them</h2>
          <p className="text-muted-foreground text-sm">
            One question to both routes at once. Same retrieval, same prompt, same model; only the
            model call and the stream format differ. Both runs are saved and show in the ledger.
          </p>
        </header>
        <form onSubmit={run} className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-64 flex-1 flex-col gap-1.5">
            <Label htmlFor="race-q">Question</Label>
            <Input id="race-q" value={question} onChange={(e) => setQuestion(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="race-model">Model</Label>
            <NativeSelect id="race-model" value={model} onChange={(e) => setModel(e.target.value)}>
              {allChatModels.map((m) => (
                <NativeSelectOption key={m.id} value={m.id}>
                  {m.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <Button type="submit" disabled={running || !question.trim()}>
            {running ? "Racing…" : "Race"}
          </Button>
        </form>
        {lanes && (
          <div className="grid gap-4 lg:grid-cols-2">
            {ROUTES.map((r) => (
              <LaneView key={r.key} label={r.label} lane={lanes[r.key]} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CodeSide({ side }: { side: SourceSide }) {
  const [open, setOpen] = useState(side.files[0].path);
  const file = side.files.find((f) => f.path === open) ?? side.files[0];
  return (
    <div className="flex min-w-0 flex-col rounded-lg border">
      <div className="flex flex-col gap-2 border-b p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-medium">{side.label}</h2>
          <span className="text-muted-foreground text-xs tabular-nums">
            {side.files.length} {side.files.length === 1 ? "file" : "files"} ·{" "}
            {formatInt(side.codeLines)} lines of code ({formatInt(side.lines)} with comments)
          </span>
        </div>
        <ul className="flex flex-col gap-1 text-xs">
          {side.files.map((f) => (
            <li key={f.path}>
              <button
                type="button"
                onClick={() => setOpen(f.path)}
                className={`flex w-full items-baseline gap-2 rounded px-1.5 py-0.5 text-left ${
                  f.path === file.path ? "bg-muted" : "hover:bg-muted/60"
                }`}
              >
                <code className="shrink-0">{f.path}</code>
                <span className="text-muted-foreground min-w-0 flex-1 truncate">{f.role}</span>
                <span className="text-muted-foreground tabular-nums">{f.codeLines}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <pre className="max-h-[36rem] overflow-auto p-4 text-xs leading-relaxed">
        <code>{file.text}</code>
      </pre>
    </div>
  );
}

function LaneView({ label, lane }: { label: string; lane: Lane }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-md border p-3 text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-medium">{label}</h3>
        {lane.runId && (
          <Link
            href={`/runs/${lane.runId}/prompt`}
            className="text-muted-foreground text-xs underline"
          >
            Inspect run
          </Link>
        )}
      </div>
      <dl className="grid grid-cols-3 gap-2 text-xs tabular-nums sm:grid-cols-6">
        <Stat label="First token" value={formatMs(lane.ttftMs)} />
        <Stat label="Total" value={formatMs(lane.totalMs)} />
        <Stat label="Events" value={formatInt(lane.frames.length)} />
        <Stat label="Bytes" value={formatInt(lane.bytes)} />
        <Stat label="Input tok." value={formatInt(lane.inputTokens)} />
        <Stat label="Output tok." value={formatInt(lane.outputTokens)} />
      </dl>
      {lane.error && <p className="text-destructive text-xs">{lane.error}</p>}
      <p className="whitespace-pre-wrap">{lane.text || "…"}</p>
      <details>
        <summary className="text-muted-foreground cursor-pointer text-xs">
          Wire format: every event as received
        </summary>
        <ol className="mt-2 flex max-h-80 flex-col gap-1 overflow-auto font-mono text-[11px]">
          {lane.frames.map((f, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-muted-foreground w-14 shrink-0 text-right">{f.atMs} ms</span>
              <Badge variant="outline" className="h-4 shrink-0 px-1 text-[10px]">
                {f.event}
              </Badge>
              <span className="min-w-0 break-all">
                {f.data.length > 240 ? `${f.data.slice(0, 240)}…` : f.data}
              </span>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
