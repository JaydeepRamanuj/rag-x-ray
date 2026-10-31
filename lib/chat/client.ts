import type { ChatMessage } from "@/lib/llm/types";
import { readSse, type ReadInfo } from "@/lib/sse/parser";

import type { ChatEvent } from "./events";

export type ChatRequest = {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  debug?: boolean;
  source?: "chat" | "debugger" | "inspector";
  mode?: "raw" | "rag";
  topK?: number;
  parentRunId?: string;
  question?: string;
  chunks?: { chunkId: string; rank: number; score: number; usedInPrompt: boolean }[];
};

export type StreamOptions = {
  signal?: AbortSignal;
  onEvent: (event: ChatEvent, clientMs: number) => void;
  /** Called once per network read, before that read's events. */
  onRead?: (info: ReadInfo, clientMs: number) => void;
  /**
   * Pause after each read to fake a slow consumer. The server keeps sending
   * meanwhile, so bytes queue up and later reads hold several events at once.
   */
  slowReadMs?: number;
};

/**
 * POSTs to /api/chat and parses the SSE response by hand. EventSource can't
 * be used here: it only does GET and can't send a JSON body.
 * Resolves when the stream ends; rejects with an AbortError if stopped.
 */
export async function streamChat(request: ChatRequest, options: StreamOptions): Promise<void> {
  const t0 = performance.now();
  const since = () => Math.round(performance.now() - t0);

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
    signal: options.signal,
  });
  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed with ${response.status}`);
  }

  const onRead = async (info: ReadInfo) => {
    options.onRead?.(info, since());
    if (options.slowReadMs) await new Promise((r) => setTimeout(r, options.slowReadMs));
  };

  for await (const sse of readSse(response.body, onRead)) {
    options.onEvent({ event: sse.event, data: JSON.parse(sse.data) } as ChatEvent, since());
  }
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}
