import { describe, expect, it } from "vitest";

import { recursiveChunk } from "./recursive";

// A word-count "tokenizer" keeps expectations readable.
const words = (t: string) => t.split(/\s+/).filter(Boolean).length;

const paragraph = (n: number, word = "word") =>
  Array.from({ length: n }, (_, i) => `${word}${i}`).join(" ") + ".";

describe("recursiveChunk", () => {
  it("keeps short text as a single chunk", () => {
    const chunks = recursiveChunk("Hello world.", { chunkSize: 10, overlap: 0, count: words });
    expect(chunks).toEqual([{ content: "Hello world.", startChar: 0, endChar: 12, tokenCount: 2 }]);
  });

  it("splits on paragraph breaks before anything finer", () => {
    const text = `${paragraph(6, "a")}\n\n${paragraph(6, "b")}`;
    const chunks = recursiveChunk(text, { chunkSize: 8, overlap: 0, count: words });
    expect(chunks.map((c) => c.content)).toEqual([paragraph(6, "a"), paragraph(6, "b")]);
  });

  it("never exceeds the chunk size and keeps offsets exact", () => {
    const text = Array.from({ length: 12 }, (_, i) => paragraph(5 + (i % 7), `p${i}w`)).join(
      "\n\n",
    );
    const chunks = recursiveChunk(text, { chunkSize: 20, overlap: 4, count: words });
    expect(chunks.length).toBeGreaterThan(3);
    for (const c of chunks) {
      expect(c.tokenCount).toBeLessThanOrEqual(20);
      expect(text.slice(c.startChar, c.endChar)).toBe(c.content);
    }
  });

  it("overlaps neighbouring chunks", () => {
    const text = [1, 2, 3, 4, 5, 6].map((n) => `Sentence number ${n} here.`).join(" ");
    const chunks = recursiveChunk(text, { chunkSize: 8, overlap: 4, count: words });
    for (let k = 1; k < chunks.length; k++) {
      expect(chunks[k].startChar).toBeLessThan(chunks[k - 1].endChar);
    }
  });

  it("falls back to sentences, then words, for a long paragraph", () => {
    const text = paragraph(30);
    const chunks = recursiveChunk(text, { chunkSize: 10, overlap: 0, count: words });
    expect(chunks).toHaveLength(3);
    expect(chunks.every((c) => c.tokenCount <= 10)).toBe(true);
  });

  it("hard-splits a single token longer than the chunk", () => {
    const blob = "x".repeat(50);
    const chunks = recursiveChunk(blob, { chunkSize: 10, overlap: 0, count: (t) => t.length });
    expect(chunks.map((c) => c.content.length)).toEqual([10, 10, 10, 10, 10]);
  });

  it("drops whitespace-only pieces", () => {
    const chunks = recursiveChunk("one.\n\n\n\n   \n\ntwo.", {
      chunkSize: 1,
      overlap: 0,
      count: words,
    });
    expect(chunks.map((c) => c.content)).toEqual(["one.", "two."]);
  });

  it("rejects an overlap as large as the chunk", () => {
    expect(() => recursiveChunk("x", { chunkSize: 10, overlap: 10 })).toThrow();
  });
});
