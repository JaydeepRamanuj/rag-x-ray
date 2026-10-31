import type { ChatModel } from "@/lib/config";

import type { RetryInfo } from "./retry";

export type Role = "system" | "user" | "assistant";

/** Our provider-neutral message. Each adapter maps it to its provider's shape. */
export type ChatMessage = { role: Role; content: string };

export type ChatParams = {
  model: ChatModel;
  messages: ChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
  onRetry?: (info: RetryInfo) => void;
};

/**
 * Token usage, normalised. Providers disagree on what "output" means: Gemini
 * reports answer tokens and thinking tokens separately, Groq folds reasoning
 * into completion_tokens. Here outputTokens is always what you're billed for
 * (answer + thinking), and reasoningTokens is the thinking part of it.
 */
export type Usage = {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
};

export type StreamChunk =
  | { type: "text"; text: string }
  | { type: "usage"; usage: Usage }
  | { type: "finish"; reason: string }
  /** The upstream SSE data exactly as received, for the streaming debugger. */
  | { type: "raw"; data: string };

export type StreamResult = {
  /** Headers worth showing: rate limits, request IDs. */
  headers: Record<string, string>;
  attempts: number;
  chunks: AsyncGenerator<StreamChunk>;
};

export type ChatResult = {
  text: string;
  usage: Usage;
  finishReason: string;
  attempts: number;
};

export type TokenCount = { tokens: number; exact: boolean; method: string };

export interface LlmProvider {
  chat(params: ChatParams): Promise<ChatResult>;
  chatStream(params: ChatParams): Promise<StreamResult>;
  countTokens(params: Pick<ChatParams, "model" | "messages">): Promise<TokenCount>;
}

export function emptyUsage(): Usage {
  return { inputTokens: 0, outputTokens: 0, cachedTokens: 0, reasoningTokens: 0 };
}

/** Collects a stream into a single result: chat() is just chatStream() drained. */
export async function drain(stream: StreamResult): Promise<ChatResult> {
  let text = "";
  let usage = emptyUsage();
  let finishReason = "unknown";
  for await (const chunk of stream.chunks) {
    if (chunk.type === "text") text += chunk.text;
    else if (chunk.type === "usage") usage = chunk.usage;
    else if (chunk.type === "finish") finishReason = chunk.reason;
  }
  return { text, usage, finishReason, attempts: stream.attempts };
}

/** Keeps only headers that teach something; never auth or cookies. */
export function pickHeaders(headers: Headers, pattern: RegExp): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    if (pattern.test(key)) out[key] = value;
  });
  return out;
}
