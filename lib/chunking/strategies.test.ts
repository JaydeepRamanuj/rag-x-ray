import { describe, expect, it } from "vitest";

import { fixedChunk } from "./fixed";
import { recursiveChunk } from "./recursive";
import { sentenceChunk, splitSentences } from "./sentence";
import { cutsWord, segmentsFor } from "./segments";
import { chunkStats } from "./stats";

// Characters as tokens keeps fixed-size expectations exact.
const chars = (t: string) => t.length;
const words = (t: string) => t.split(/\s+/).filter(Boolean).length;

const prose = [
  "Chunking decides what retrieval can find. Small chunks are precise.",
  "Large chunks carry context. Overlap repeats the edges!",
  "Is a sentence cut? Only fixed-size splitting does that often.",
].join("\n\n");

function expectExactOffsets(
  text: string,
  chunks: { content: string; startChar: number; endChar: number }[],
) {
  for (const c of chunks) expect(text.slice(c.startChar, c.endChar)).toBe(c.content);
}

describe("fixedChunk", () => {
  it("cuts at exactly chunkSize, wherever that lands", () => {
    const chunks = fixedChunk("abcdefghij", { chunkSize: 4, overlap: 0, count: chars });
    expect(chunks.map((c) => c.content)).toEqual(["abcd", "efgh", "ij"]);
  });

  it("repeats `overlap` tokens at the start of the next chunk", () => {
    const chunks = fixedChunk("abcdefghij", { chunkSize: 4, overlap: 1, count: chars });
    expect(chunks.map((c) => c.content)).toEqual(["abcd", "defg", "ghij"]);
  });

  it("keeps offsets exact and never exceeds the size", () => {
    const chunks = fixedChunk(prose, { chunkSize: 30, overlap: 5, count: chars });
    expectExactOffsets(prose, chunks);
    expect(chunks.every((c) => c.tokenCount <= 30)).toBe(true);
  });
});

describe("splitSentences", () => {
  it("tiles the text and keeps abbreviations and decimals inside a sentence", () => {
    const text = "Dr. Smith ran pgvector 0.8 on it. It works!\n\nNext para.";
    const spans = splitSentences(text);
    expect(spans.map((s) => text.slice(s.start, s.end).trim())).toEqual([
      "Dr. Smith ran pgvector 0.8 on it.",
      "It works!",
      "Next para.",
    ]);
    expect(spans[0].start).toBe(0);
    expect(spans.at(-1)!.end).toBe(text.length);
    for (let i = 1; i < spans.length; i++) expect(spans[i].start).toBe(spans[i - 1].end);
  });
});

describe("sentenceChunk", () => {
  it("only cuts between sentences", () => {
    const chunks = sentenceChunk(prose, { chunkSize: 14, overlap: 0, count: words });
    expectExactOffsets(prose, chunks);
    expect(chunkStats(prose, chunks, words(prose)).cutSentences).toBe(0);
  });

  it("overlaps by whole sentences", () => {
    const text = [1, 2, 3, 4, 5].map((n) => `This is sentence ${n}.`).join(" ");
    const chunks = sentenceChunk(text, { chunkSize: 8, overlap: 4, count: words });
    expect(chunks.map((c) => c.content)).toEqual([
      "This is sentence 1. This is sentence 2.",
      "This is sentence 2. This is sentence 3.",
      "This is sentence 3. This is sentence 4.",
      "This is sentence 4. This is sentence 5.",
    ]);
  });

  it("hard-splits a sentence longer than a chunk", () => {
    const text = "x".repeat(25) + ".";
    const chunks = sentenceChunk(text, { chunkSize: 10, overlap: 0, count: chars });
    expect(chunks.map((c) => c.tokenCount)).toEqual([10, 10, 6]);
  });
});

describe("chunkStats", () => {
  it("counts sentences cut by a fixed split but not by a sentence split", () => {
    const opts = { chunkSize: 70, overlap: 0, count: chars };
    const fixed = chunkStats(prose, fixedChunk(prose, opts), prose.length);
    const recursive = chunkStats(prose, recursiveChunk(prose, opts), prose.length);
    expect(fixed.sentences).toBe(6);
    expect(fixed.cutSentences).toBeGreaterThan(0);
    expect(recursive.cutSentences).toBe(0);
  });

  it("reports size spread and duplication", () => {
    const stats = chunkStats(
      "abcdefghij",
      fixedChunk("abcdefghij", { chunkSize: 4, overlap: 1, count: chars }),
      10,
    );
    expect(stats).toMatchObject({
      chunks: 3,
      avgTokens: 4,
      stdTokens: 0,
      minTokens: 4,
      maxTokens: 4,
      duplication: 1.2,
    });
  });
});

describe("segmentsFor", () => {
  it("splits text into stretches with their chunk and overlap count", () => {
    const segs = segmentsFor(10, [
      { startChar: 0, endChar: 6 },
      { startChar: 4, endChar: 9 },
    ]);
    expect(segs).toEqual([
      { start: 0, end: 4, chunk: 0, cover: 1 },
      { start: 4, end: 6, chunk: 0, cover: 2 },
      { start: 6, end: 9, chunk: 1, cover: 1 },
      { start: 9, end: 10, chunk: null, cover: 0 },
    ]);
  });

  it("spots a cut through the middle of a word", () => {
    expect(cutsWord("retrieval", 4)).toBe(true);
    expect(cutsWord("two words", 3)).toBe(false);
  });
});
