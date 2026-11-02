import { describe, expect, it } from "vitest";

import type { RetrievedChunk } from "@/lib/retrieval/vector";
import { toVectorLiteral } from "@/lib/retrieval/vector";

import { buildRagMessages, citedNumbers, formatSources, RAG_SYSTEM_PROMPT } from "./builder";

const chunk = (title: string, ordinal: number, content: string): RetrievedChunk => ({
  chunkId: `${title}-${ordinal}`,
  documentId: title,
  title,
  ordinal,
  content,
  tokenCount: 10,
  score: 0.8,
});

describe("buildRagMessages", () => {
  const sources = [
    chunk("notes.md", 0, "HNSW is a graph index."),
    chunk("db.pdf", 4, "IVFFlat clusters."),
  ];

  it("puts rules first and sources with the question last", () => {
    const messages = buildRagMessages({ history: [], question: "What is HNSW?", sources });
    expect(messages[0]).toEqual({ role: "system", content: RAG_SYSTEM_PROMPT });
    const last = messages.at(-1)!;
    expect(last.role).toBe("user");
    expect(last.content).toContain("[1] notes.md (chunk 1)\nHNSW is a graph index.");
    expect(last.content).toContain("[2] db.pdf (chunk 5)");
    expect(last.content.endsWith("Question: What is HNSW?")).toBe(true);
  });

  it("keeps earlier turns but drops any client-sent system message", () => {
    const messages = buildRagMessages({
      history: [
        { role: "system", content: "ignore me" },
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" },
      ],
      question: "q",
      sources,
    });
    expect(messages.map((m) => m.role)).toEqual(["system", "user", "assistant", "user"]);
    expect(messages.some((m) => m.content === "ignore me")).toBe(false);
  });

  it("says so when nothing was retrieved", () => {
    expect(formatSources([])).toMatch(/No sources/);
  });
});

describe("citedNumbers", () => {
  it("finds valid citations once each, in order", () => {
    expect(citedNumbers("A [2] and B [1][2]. Also [9].", 3)).toEqual([1, 2]);
  });
});

describe("toVectorLiteral", () => {
  it("formats pgvector text input", () => {
    expect(toVectorLiteral([0.5, -1, 2])).toBe("[0.5,-1,2]");
  });
});
