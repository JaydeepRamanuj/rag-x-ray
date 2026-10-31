import type { Usage } from "@/lib/llm/types";
import type { RetrievedChunk } from "@/lib/retrieval/vector";

export type Source = RetrievedChunk & { n: number };

/**
 * The events /api/chat sends, in order:
 *   start → retrieval? → (retry)* → meta → (upstream | token)* → usage? → done | error
 *
 * Timings are milliseconds since the server received the request, so the
 * client can line them up against its own clock for the debugger timeline.
 */
export type ChatEventMap = {
  start: { runId: string; model: string; provider: string };
  /** RAG mode only: what was retrieved and how long each step took. */
  retrieval: {
    atMs: number;
    embedMs: number;
    searchMs: number;
    queryCached: boolean;
    embedTokens: number;
    /** How the sources were ranked: the chosen method, or "rerank" on top of it. */
    method: string;
    rerank: { cached: boolean; billedTokens: number; ms: number } | null;
    sources: Source[];
  };
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
