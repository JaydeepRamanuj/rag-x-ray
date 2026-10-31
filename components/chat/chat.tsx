"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { isAbortError, streamChat } from "@/lib/chat/client";
import { allChatModels, defaults } from "@/lib/config";
import { formatInt, formatMs, formatUsd } from "@/lib/format";
import type { ChatMessage, Usage } from "@/lib/llm/types";

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
};

type Turn = { id: number; role: "user" | "assistant"; content: string; stats?: Stats };

export function Chat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState<string>(defaults.chatModel);
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
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
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
        { model, messages, source: "chat" },
        {
          signal: controller.signal,
          onEvent: (e, clientMs) => {
            switch (e.event) {
              case "start":
                return updateStats({ runId: e.data.runId });
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
              <p className="text-foreground text-base font-medium">Ask anything.</p>
              <p className="mt-1">
                Phase 1 talks to the model directly. Your documents arrive in Phase 2.
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
                <div className="leading-relaxed whitespace-pre-wrap">
                  {turn.content}
                  {turn.stats?.status === "streaming" && (
                    <span className="bg-foreground ml-0.5 inline-block h-4 w-1.5 animate-pulse align-middle" />
                  )}
                </div>
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
          <div className="flex items-center justify-between gap-2">
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
        <Link href={`/runs/${stats.runId}/stream`} className="underline underline-offset-2">
          Inspect stream
        </Link>
      )}
    </div>
  );
}
