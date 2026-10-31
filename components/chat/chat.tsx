"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, ScanSearch, Square } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { isAbortError, streamChat } from "@/lib/chat/client";
import type { Source } from "@/lib/chat/events";
import { allChatModels, defaults } from "@/lib/config";
import { formatInt, formatMs, formatUsd } from "@/lib/format";
import type { ChatMessage, Usage } from "@/lib/llm/types";
import { citedNumbers } from "@/lib/prompt/builder";

const SYSTEM_PROMPT = "You are a helpful assistant. Answer concisely.";

type Stats = {
  runId?: string;
  model: string;
  status: "streaming" | "ok" | "stopped" | "error";
  ttftMs: number | null;
  totalMs: number | null;
  usage: Usage | null;
  estCostUsd: number | null;
  retries: number;
  error?: string;
  retrieval?: { embedMs: number; searchMs: number; queryCached: boolean };
};

type Turn = {
  id: number;
  role: "user" | "assistant";
  content: string;
  stats?: Stats;
  /** RAG mode: the numbered chunks this answer was given. */
  sources?: Source[];
};

const TOP_K_OPTIONS = [3, 5, 8, 10];

export function Chat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState<string>(defaults.chatModel);
  const [useDocs, setUseDocs] = useState(true);
  const [topK, setTopK] = useState<number>(defaults.topK);
  const [now, setNow] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const nextId = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const streaming = turns.at(-1)?.stats?.status === "streaming";

  // A ticking clock so the elapsed time and TTFT counters move while waiting.
  useEffect(() => {
    if (!streaming) return;
    const timer = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(timer);
  }, [streaming]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [turns]);

  function updateLast(fn: (turn: Turn) => Turn) {
    setTurns((prev) => [...prev.slice(0, -1), fn(prev.at(-1)!)]);
  }
  function updateStats(patch: Partial<Stats>) {
    updateLast((t) => ({ ...t, stats: { ...t.stats!, ...patch } }));
  }

  async function send() {
    const question = input.trim();
    if (!question || streaming) return;

    // History is every finished turn. The model has no memory: each request
    // re-sends the whole conversation, which is why long chats cost more.
    const history: ChatMessage[] = turns
      .filter((t) => t.content && t.stats?.status !== "error")
      .map((t) => ({ role: t.role, content: t.content }));
    // In RAG mode the server owns the system prompt and adds the sources,
    // so only the conversation itself is sent.
    const messages: ChatMessage[] = [
      ...(useDocs ? [] : [{ role: "system" as const, content: SYSTEM_PROMPT }]),
      ...history,
      { role: "user", content: question },
    ];

    setInput("");
    setTurns((prev) => [
      ...prev,
      { id: nextId.current++, role: "user", content: question },
      {
        id: nextId.current++,
        role: "assistant",
        content: "",
        stats: {
          model,
          status: "streaming",
          ttftMs: null,
          totalMs: null,
          usage: null,
          estCostUsd: null,
          retries: 0,
        },
      },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;
    const start = performance.now();
    setStartedAt(start);
    setNow(start);

    try {
      await streamChat(
        { model, messages, source: "chat", mode: useDocs ? "rag" : "raw", topK },
        {
          signal: controller.signal,
          onEvent: (e, clientMs) => {
            switch (e.event) {
              case "start":
                return updateStats({ runId: e.data.runId });
              case "retrieval":
                return updateLast((t) => ({
                  ...t,
                  sources: e.data.sources,
                  stats: {
                    ...t.stats!,
                    retrieval: {
                      embedMs: e.data.embedMs,
                      searchMs: e.data.searchMs,
                      queryCached: e.data.queryCached,
                    },
                  },
                }));
              case "retry":
                return updateLast((t) => ({
                  ...t,
                  stats: { ...t.stats!, retries: t.stats!.retries + 1 },
                }));
              case "token":
                return updateLast((t) => ({
                  ...t,
                  content: t.content + e.data.text,
                  // Measured in the browser, so it includes network time.
                  stats: { ...t.stats!, ttftMs: t.stats!.ttftMs ?? clientMs },
                }));
              case "usage":
                return updateStats({ usage: e.data });
              case "done":
                return updateStats({
                  status: e.data.status,
                  totalMs: clientMs,
                  usage: e.data.usage,
                  estCostUsd: e.data.estCostUsd,
                });
              case "error":
                return updateStats({ status: "error", totalMs: clientMs, error: e.data.message });
            }
          },
        },
      );
    } catch (err) {
      const totalMs = Math.round(performance.now() - start);
      if (isAbortError(err)) updateStats({ status: "stopped", totalMs });
      else updateStats({ status: "error", totalMs, error: String(err) });
    } finally {
      abortRef.current = null;
    }
  }

  return (
    <div className="flex h-[calc(100svh-3rem)] flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
          {turns.length === 0 && (
            <div className="text-muted-foreground py-24 text-center text-sm">
              <p className="text-foreground text-base font-medium">Ask about your documents.</p>
              <p className="mt-1">
                With &quot;Use documents&quot; on, the closest chunks are retrieved and the answer
                cites them. Turn it off to talk to the model directly.
              </p>
            </div>
          )}
          {turns.map((turn) =>
            turn.role === "user" ? (
              <div
                key={turn.id}
                className="bg-muted self-end rounded-2xl px-4 py-2 whitespace-pre-wrap"
              >
                {turn.content}
              </div>
            ) : (
              <div key={turn.id} className="flex flex-col gap-2">
                <div className="leading-relaxed">
                  <AnswerText turnId={turn.id} text={turn.content} sources={turn.sources} />
                  {turn.stats?.status === "streaming" && (
                    <span className="bg-foreground ml-0.5 inline-block h-4 w-1.5 animate-pulse align-middle" />
                  )}
                </div>
                {turn.sources && (
                  <SourceList turnId={turn.id} sources={turn.sources} answer={turn.content} />
                )}
                {turn.stats && (
                  <StatsLine stats={turn.stats} elapsedMs={Math.round(now - startedAt)} />
                )}
              </div>
            ),
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t p-4">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Ask a question. Enter to send, Shift+Enter for a new line."
            className="max-h-48 min-h-20 resize-none"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <NativeSelect
                value={model}
                onChange={(e) => setModel(e.target.value)}
                aria-label="Model"
                disabled={streaming}
              >
                {allChatModels.map((m) => (
                  <NativeSelectOption key={m.id} value={m.id}>
                    {m.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <div className="flex items-center gap-2">
                <Switch
                  id="use-docs"
                  checked={useDocs}
                  onCheckedChange={setUseDocs}
                  disabled={streaming}
                />
                <Label htmlFor="use-docs">Use documents</Label>
              </div>
              {useDocs && (
                <NativeSelect
                  value={String(topK)}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  aria-label="Chunks to retrieve"
                  disabled={streaming}
                >
                  {TOP_K_OPTIONS.map((k) => (
                    <NativeSelectOption key={k} value={k}>
                      top {k}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </div>
            {streaming ? (
              <Button variant="outline" onClick={() => abortRef.current?.abort()}>
                <Square className="fill-current" /> Stop
              </Button>
            ) : (
              <Button onClick={() => void send()} disabled={!input.trim()}>
                <ArrowUp /> Send
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsLine({ stats, elapsedMs }: { stats: Stats; elapsedMs: number }) {
  const label = allChatModels.find((m) => m.id === stats.model)?.label ?? stats.model;
  const u = stats.usage;
  const live = stats.status === "streaming";

  const items: [string, string][] = [
    [
      "TTFT",
      stats.ttftMs != null ? formatMs(stats.ttftMs) : live ? `${formatMs(elapsedMs)}…` : "–",
    ],
    ["total", live ? formatMs(elapsedMs) : formatMs(stats.totalMs)],
    ["in", formatInt(u?.inputTokens)],
    [
      "out",
      u
        ? `${formatInt(u.outputTokens)}${u.reasoningTokens ? ` (${u.reasoningTokens} thinking)` : ""}`
        : "–",
    ],
    ["cost if paid", formatUsd(stats.estCostUsd)],
  ];
  if (stats.retrieval) {
    items.unshift(
      [
        "embed",
        `${formatMs(stats.retrieval.embedMs)}${stats.retrieval.queryCached ? " (cached)" : ""}`,
      ],
      ["search", formatMs(stats.retrieval.searchMs)],
    );
  }

  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs">
      <span className="text-foreground/70">{label}</span>
      {items.map(([k, v]) => (
        <span key={k}>
          {k} <span className="text-foreground">{v}</span>
        </span>
      ))}
      {stats.retries > 0 && <span className="text-amber-600">{stats.retries} retries</span>}
      {stats.status === "stopped" && <span className="text-amber-600">stopped</span>}
      {stats.status === "error" && <span className="text-destructive">{stats.error}</span>}
      {stats.runId && !live && stats.status !== "error" && (
        <>
          <Button
            variant="outline"
            size="xs"
            nativeButton={false}
            render={<Link href={`/runs/${stats.runId}/prompt`} />}
          >
            <ScanSearch /> Inspect
          </Button>
          <Link href={`/runs/${stats.runId}/stream`} className="underline underline-offset-2">
            Stream
          </Link>
        </>
      )}
    </div>
  );
}

const sourceId = (turnId: number, n: number) => `source-${turnId}-${n}`;

/**
 * Renders the answer as Markdown, with each "[2]" turned into a link that
 * opens source 2 below it. Citations are rewritten to Markdown links first
 * so the Markdown parser handles them like any other inline element.
 */
function AnswerText({
  turnId,
  text,
  sources,
}: {
  turnId: number;
  text: string;
  sources?: Source[];
}) {
  const count = sources?.length ?? 0;
  const withLinks = count
    ? text.replace(/\[(\d+)\]/g, (m, n) =>
        Number(n) >= 1 && Number(n) <= count ? `[[${n}]](#cite-${n})` : m,
      )
    : text;

  return (
    <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href = "", children }) => {
            const n = Number(/^#cite-(\d+)$/.exec(href)?.[1]);
            if (!n) {
              return (
                <a href={href} target="_blank" rel="noreferrer">
                  {children}
                </a>
              );
            }
            return (
              <button
                type="button"
                className="text-primary mx-0.5 cursor-pointer align-super text-[0.7em] font-semibold hover:underline"
                onClick={() => {
                  const el = document.getElementById(sourceId(turnId, n));
                  if (el instanceof HTMLDetailsElement) el.open = true;
                  el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
                }}
              >
                [{n}]
              </button>
            );
          },
        }}
      >
        {withLinks}
      </ReactMarkdown>
    </div>
  );
}

function SourceList({
  turnId,
  sources,
  answer,
}: {
  turnId: number;
  sources: Source[];
  answer: string;
}) {
  if (sources.length === 0) {
    return <p className="text-muted-foreground text-xs">No documents to search yet.</p>;
  }
  const cited = new Set(citedNumbers(answer, sources.length));
  return (
    <div className="flex flex-col gap-1">
      {sources.map((s) => (
        <details key={s.n} id={sourceId(turnId, s.n)} className="group rounded-md border text-xs">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-2 py-1.5">
            <span
              className={cited.has(s.n) ? "text-primary font-semibold" : "text-muted-foreground"}
            >
              [{s.n}]
            </span>
            <span className="truncate">{s.title}</span>
            <span className="text-muted-foreground shrink-0">chunk {s.ordinal + 1}</span>
            {/* Cosine similarity, drawn as a bar so rank gaps are visible at a glance. */}
            <span className="bg-muted ml-auto h-1.5 w-16 shrink-0 overflow-hidden rounded-full">
              <span
                className="bg-primary/70 block h-full"
                style={{ width: `${Math.max(0, s.score) * 100}%` }}
              />
            </span>
            <span className="text-muted-foreground w-10 shrink-0 text-right font-mono">
              {s.score.toFixed(3)}
            </span>
            {!cited.has(s.n) && <span className="text-muted-foreground shrink-0">not cited</span>}
          </summary>
          <p className="text-muted-foreground border-t px-2 py-2 whitespace-pre-wrap">
            {s.content}
          </p>
        </details>
      ))}
    </div>
  );
}
