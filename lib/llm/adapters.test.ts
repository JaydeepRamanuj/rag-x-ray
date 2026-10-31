import { describe, expect, it } from "vitest";

import { chatModels } from "@/lib/config";

import { parseGeminiChunk, toGeminiBody } from "./gemini";
import { parseGroqChunk, toGroqBody } from "./groq";

// Fixtures trimmed from real responses captured on 2026-10-31.

const messages = [
  { role: "system" as const, content: "Be brief." },
  { role: "user" as const, content: "Hi" },
  { role: "assistant" as const, content: "Hello!" },
  { role: "user" as const, content: "Why is the sky blue?" },
];

describe("Gemini adapter", () => {
  it("moves the system prompt out and renames assistant to model", () => {
    const body = toGeminiBody({ model: chatModels.geminiFlashLite, messages });
    expect(body.systemInstruction).toEqual({ parts: [{ text: "Be brief." }] });
    expect(body.contents.map((c) => c.role)).toEqual(["user", "model", "user"]);
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "minimal" });
  });

  it("parses text and running usage from a chunk", () => {
    const chunks = parseGeminiChunk({
      candidates: [{ content: { parts: [{ text: "The sky" }] } }],
      usageMetadata: { promptTokenCount: 13, candidatesTokenCount: 2 },
    });
    expect(chunks).toEqual([
      { type: "text", text: "The sky" },
      {
        type: "usage",
        usage: { inputTokens: 13, outputTokens: 2, cachedTokens: 0, reasoningTokens: 0 },
      },
    ]);
  });

  it("skips thought parts and signature-only parts, counts thinking as output", () => {
    const chunks = parseGeminiChunk({
      candidates: [
        {
          content: { parts: [{ text: "thinking...", thought: true }, { text: "" }] },
          finishReason: "STOP",
        },
      ],
      usageMetadata: { promptTokenCount: 13, candidatesTokenCount: 24, thoughtsTokenCount: 10 },
    });
    expect(chunks).toEqual([
      {
        type: "usage",
        usage: { inputTokens: 13, outputTokens: 34, cachedTokens: 0, reasoningTokens: 10 },
      },
      { type: "finish", reason: "STOP" },
    ]);
  });
});

describe("Groq adapter", () => {
  it("passes messages through and asks for usage in the stream", () => {
    const body = toGroqBody({ model: chatModels.groqSmall, messages });
    expect(body.messages).toBe(messages);
    expect(body.stream_options).toEqual({ include_usage: true });
    expect(body.reasoning_effort).toBe("low");
  });

  it("parses a content delta", () => {
    expect(
      parseGroqChunk({ choices: [{ delta: { content: "Because" }, finish_reason: null }] }),
    ).toEqual([{ type: "text", text: "Because" }]);
  });

  it("parses the final usage chunk", () => {
    const chunks = parseGroqChunk({
      choices: [{ delta: {}, finish_reason: "stop" }],
      usage: {
        prompt_tokens: 86,
        completion_tokens: 30,
        completion_tokens_details: { reasoning_tokens: 5 },
      },
    });
    expect(chunks).toEqual([
      { type: "finish", reason: "stop" },
      {
        type: "usage",
        usage: { inputTokens: 86, outputTokens: 30, cachedTokens: 0, reasoningTokens: 5 },
      },
    ]);
  });
});
