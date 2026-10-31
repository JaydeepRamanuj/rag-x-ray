import type { Usage } from "@/lib/llm/types";

/**
 * The events /api/chat sends, in order:
 *   start → (retry)* → meta → (upstream | token)* → usage? → done | error
 *
 * Timings are milliseconds since the server received the request, so the
 * client can line them up against its own clock for the debugger timeline.
 */
export type ChatEventMap = {
  start: { runId: string; model: string; provider: string };
  retry: { attempt: number; status: number; delayMs: number; atMs: number };
  /** Upstream responded with headers: the request was accepted. */
  meta: { atMs: number; attempts: number; headers: Record<string, string> };
  /** One raw upstream SSE payload. Only sent when the request asks for debug. */
  upstream: { atMs: number; data: string };
  token: { text: string };
  usage: Usage;
  done: {
    runId: string;
    status: "ok" | "stopped";
    finishReason: string;
    ttftMs: number | null;
    totalMs: number;
    lastTokenMs: number | null;
    usage: Usage | null;
    estCostUsd: number | null;
  };
  error: { runId: string; message: string; status?: number };
};

export type ChatEventName = keyof ChatEventMap;

export type ChatEvent = {
  [K in ChatEventName]: { event: K; data: ChatEventMap[K] };
}[ChatEventName];
