import { countTokens as countHarmonyTokens } from "gpt-tokenizer/encoding/o200k_harmony";

import { readSse } from "@/lib/sse/parser";

import { fetchWithRetry } from "./retry";
import { drain, pickHeaders, type ChatParams, type LlmProvider, type StreamChunk } from "./types";

const URL = "https://api.groq.com/openai/v1/chat/completions";

function apiKey(): string {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set");
  return key;
}

/** Groq speaks the OpenAI chat-completions dialect: messages pass through as-is. */
export function toGroqBody(params: ChatParams) {
  return {
    model: params.model.id,
    messages: params.messages,
    temperature: params.temperature,
    // max_tokens is deprecated in favour of this.
    max_completion_tokens: params.maxOutputTokens,
    reasoning_effort: params.model.reasoning,
    // GPT-OSS returns its reasoning text unless told not to. We still see
    // the count in usage.completion_tokens_details.reasoning_tokens.
    include_reasoning: false,
    ...(params.json && { response_format: { type: "json_object" } }),
    stream: true,
    // Without this, a streamed response carries no token usage at all.
    stream_options: { include_usage: true },
  };
}

type GroqChunk = {
  choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
    completion_tokens_details?: { reasoning_tokens?: number };
  };
};

export function parseGroqChunk(json: GroqChunk): StreamChunk[] {
  const out: StreamChunk[] = [];
  const choice = json.choices?.[0];
  if (choice?.delta?.content) out.push({ type: "text", text: choice.delta.content });
  if (choice?.finish_reason) out.push({ type: "finish", reason: choice.finish_reason });
  // Unlike Gemini, usage only arrives once, in the last chunk(s) before [DONE].
  // Stop the stream early and you never get it.
  const u = json.usage;
  if (u) {
    out.push({
      type: "usage",
      usage: {
        inputTokens: u.prompt_tokens ?? 0,
        outputTokens: u.completion_tokens ?? 0,
        cachedTokens: u.prompt_tokens_details?.cached_tokens ?? 0,
        reasoningTokens: u.completion_tokens_details?.reasoning_tokens ?? 0,
      },
    });
  }
  return out;
}

export const groq: LlmProvider = {
  async chatStream(params) {
    const { response, attempts } = await fetchWithRetry(
      URL,
      {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey()}` },
        body: JSON.stringify(toGroqBody(params)),
        signal: params.signal,
      },
      { onRetry: params.onRetry },
    );

    async function* chunks(): AsyncGenerator<StreamChunk> {
      for await (const event of readSse(response.body!)) {
        yield { type: "raw", data: event.data };
        // The OpenAI dialect ends with a literal sentinel, not JSON.
        if (event.data === "[DONE]") return;
        yield* parseGroqChunk(JSON.parse(event.data));
      }
    }

    return {
      headers: pickHeaders(response.headers, /^x-ratelimit|^x-request-id/),
      attempts,
      chunks: chunks(),
    };
  },

  async chat(params) {
    return drain(await this.chatStream(params));
  },

  async countTokens({ messages }) {
    // Groq has no count endpoint. GPT-OSS uses the o200k_harmony tokenizer, so
    // counting locally is close, but the chat template adds tokens per message
    // that this doesn't see, so it's an estimate.
    const text = messages.map((m) => m.content).join("\n");
    return { tokens: countHarmonyTokens(text), exact: false, method: "o200k_harmony (local)" };
  },
};
