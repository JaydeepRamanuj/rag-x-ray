import { readSse } from "@/lib/sse/parser";

import { fetchWithRetry } from "./retry";
import {
  drain,
  pickHeaders,
  type ChatMessage,
  type ChatParams,
  type LlmProvider,
  type StreamChunk,
  type Usage,
} from "./types";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return key;
}

/**
 * Gemini's request shape differs from the OpenAI-style one in three ways:
 * the system prompt is a separate `systemInstruction`, the assistant role is
 * called "model", and text lives in `parts[]` because a turn can mix text,
 * images and audio.
 */
export function toGeminiBody(params: ChatParams) {
  const system = params.messages.filter((m) => m.role === "system");
  const turns = params.messages.filter((m) => m.role !== "system");
  return {
    ...(system.length > 0 && {
      systemInstruction: { parts: [{ text: system.map((m) => m.content).join("\n\n") }] },
    }),
    contents: turns.map((m: ChatMessage) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      temperature: params.temperature,
      maxOutputTokens: params.maxOutputTokens,
      thinkingConfig: { thinkingLevel: params.model.reasoning },
    },
  };
}

type GeminiChunk = {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
    finishReason?: string;
  }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    cachedContentTokenCount?: number;
  };
};

/** Turns one parsed Gemini SSE payload into our chunks. Pure, so it's unit-tested. */
export function parseGeminiChunk(json: GeminiChunk): StreamChunk[] {
  const out: StreamChunk[] = [];
  const candidate = json.candidates?.[0];
  for (const part of candidate?.content?.parts ?? []) {
    // Thought parts are the model's reasoning; the final chunk also carries an
    // empty part holding only a thoughtSignature. Neither is answer text.
    if (part.thought || !part.text) continue;
    out.push({ type: "text", text: part.text });
  }
  // Gemini repeats usageMetadata on every chunk as a running total, so the
  // latest one wins. That also means a stopped stream still has a count.
  const u = json.usageMetadata;
  if (u) {
    const thoughts = u.thoughtsTokenCount ?? 0;
    const usage: Usage = {
      inputTokens: u.promptTokenCount ?? 0,
      outputTokens: (u.candidatesTokenCount ?? 0) + thoughts,
      cachedTokens: u.cachedContentTokenCount ?? 0,
      reasoningTokens: thoughts,
    };
    out.push({ type: "usage", usage });
  }
  if (candidate?.finishReason) out.push({ type: "finish", reason: candidate.finishReason });
  return out;
}

export const gemini: LlmProvider = {
  async chatStream(params) {
    // alt=sse switches the stream from one big JSON array to SSE frames.
    const url = `${BASE}/${params.model.id}:streamGenerateContent?alt=sse`;
    const { response, attempts } = await fetchWithRetry(
      url,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey() },
        body: JSON.stringify(toGeminiBody(params)),
        signal: params.signal,
      },
      { onRetry: params.onRetry },
    );

    async function* chunks(): AsyncGenerator<StreamChunk> {
      for await (const event of readSse(response.body!)) {
        yield { type: "raw", data: event.data };
        yield* parseGeminiChunk(JSON.parse(event.data));
      }
    }

    return {
      headers: pickHeaders(response.headers, /^x-goog|^server-timing/),
      attempts,
      chunks: chunks(),
    };
  },

  async chat(params) {
    return drain(await this.chatStream(params));
  },

  async countTokens({ model, messages }) {
    // Wrapping the full request (not just `contents`) makes the count include
    // the system instruction, matching what generateContent will bill.
    const body = toGeminiBody({ model, messages });
    const res = await fetchWithRetry(`${BASE}/${model.id}:countTokens`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey() },
      body: JSON.stringify({
        generateContentRequest: {
          model: `models/${model.id}`,
          contents: body.contents,
          systemInstruction: body.systemInstruction,
        },
      }),
    });
    const json = (await res.response.json()) as { totalTokens: number };
    return { tokens: json.totalTokens, exact: true, method: "Gemini countTokens API" };
  },
};
