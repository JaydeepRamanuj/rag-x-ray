import { describe, expect, it } from "vitest";

import type { RetrievedChunk } from "@/lib/retrieval/vector";

import { promptParts, rebuildMessages, splitPrompt } from "./anatomy";
import { buildRagMessages, RAG_SYSTEM_PROMPT, sourceLabel } from "./builder";

const chunk = (title: string, ordinal: number, content: string): RetrievedChunk => ({
  chunkId: `${title}-${ordinal}`,
  documentId: title,
  title,
  ordinal,
  content,
  tokenCount: 10,
  score: 0.8,
});

const sources = [
  chunk("notes.md", 0, "HNSW is a graph index."),
  chunk("db.pdf", 4, "IVFFlat clusters.\n\nIt needs training."),
  chunk("db.pdf", 7, "pgvector supports both."),
];
const known = sources.map((s) => ({
  chunkId: s.chunkId,
  score: s.score,
  label: sourceLabel(s),
  content: s.content,
}));
const history = [
  { role: "user" as const, content: "hi" },
  { role: "assistant" as const, content: "hello" },
];
const question = "Which index?";
const messages = buildRagMessages({ history, question, sources });
// One "token" per character keeps the arithmetic easy to check.
const chars = (t: string) => t.length;

describe("splitPrompt", () => {
  it("rebuilds sources from the run's chunks when they match exactly", () => {
    const split = splitPrompt(messages, { question, chunks: known });
    expect(split.system).toBe(RAG_SYSTEM_PROMPT);
    expect(split.history).toEqual(history);
    expect(split.rag?.matchedChunks).toBe(true);
    expect(split.rag?.sources.map((s) => s.chunkId)).toEqual(sources.map((s) => s.chunkId));
  });

  it("parses the blocks back out of the text when the chunks are gone", () => {
    const split = splitPrompt(messages, { question });
    expect(split.rag?.matchedChunks).toBe(false);
    expect(split.rag?.sources.map((s) => s.label)).toEqual(known.map((k) => k.label));
    // A blank line inside a chunk must not start a new block.
    expect(split.rag?.sources[1].content).toBe("IVFFlat clusters.\n\nIt needs training.");
  });

  it("treats a plain chat message as not RAG", () => {
    const split = splitPrompt(
      [
        { role: "system", content: "Be brief." },
        { role: "user", content: "Hello" },
      ],
      { question: "Hello" },
    );
    expect(split.rag).toBeNull();
    expect(split.lastUser).toBe("Hello");
  });

  it("handles a run that retrieved nothing", () => {
    const empty = buildRagMessages({ history: [], question, sources: [] });
    expect(splitPrompt(empty, { question }).rag?.sources).toEqual([]);
  });
});

describe("promptParts", () => {
  it("lists parts in reading order and covers the whole prompt text", () => {
    const parts = promptParts(splitPrompt(messages, { question, chunks: known }), chars);
    expect(parts.map((p) => p.kind)).toEqual([
      "system",
      "history",
      "history",
      "framing",
      "source",
      "source",
      "source",
      "question",
    ]);
    // With a per-character "tokenizer", the parts add up to every character sent.
    const total = messages.reduce((s, m) => s + m.content.length, 0);
    expect(parts.reduce((s, p) => s + p.tokens, 0)).toBe(total);
  });
});

describe("rebuildMessages", () => {
  const split = splitPrompt(messages, { question, chunks: known });

  it("reproduces the original prompt when nothing is edited", () => {
    expect(rebuildMessages(split, { system: RAG_SYSTEM_PROMPT, keep: () => true })).toEqual(
      messages,
    );
  });

  it("drops removed sources and renumbers the rest", () => {
    const rebuilt = rebuildMessages(split, { system: "New rules", keep: (n) => n !== 1 });
    expect(rebuilt[0]).toEqual({ role: "system", content: "New rules" });
    const last = rebuilt.at(-1)!.content;
    expect(last).not.toContain("HNSW is a graph index.");
    expect(last).toContain("[1] db.pdf (chunk 5)");
    expect(last).toContain("[2] db.pdf (chunk 8)");
  });

  it("omits an emptied system prompt instead of sending a blank one", () => {
    const rebuilt = rebuildMessages(split, { system: "  ", keep: () => true });
    expect(rebuilt[0].role).toBe("user");
  });
});
