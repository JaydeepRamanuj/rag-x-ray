import { describe, expect, it } from "vitest";

import { semanticChunk } from "./semantic";

const words = (t: string) => t.split(/\s+/).filter(Boolean).length;

// A fake embedding: one axis per topic word, so similarity is exact and
// the test doesn't need a model. Windows mixing two topics land in between.
const topics = ["cats", "postgres", "pasta"];
async function embed(texts: string[]) {
  return texts.map((t) => {
    const v = topics.map((w) => (t.match(new RegExp(w, "gi")) ?? []).length);
    const n = Math.hypot(...v) || 1;
    return v.map((x) => x / n);
  });
}

const text = [
  "I like cats. Many cats sleep a lot. Cats purr.",
  "Postgres stores rows. Postgres has indexes. Postgres is fast.",
  "Pasta needs salt. Fresh pasta cooks fast.",
].join(" ");

describe("semanticChunk", () => {
  it("cuts where the topic changes", async () => {
    const { chunks, similarities } = await semanticChunk(text, {
      chunkSize: 100,
      threshold: 0.9,
      embed,
      count: words,
      buffer: 0,
    });
    expect(chunks.map((c) => c.content)).toEqual([
      "I like cats. Many cats sleep a lot. Cats purr.",
      "Postgres stores rows. Postgres has indexes. Postgres is fast.",
      "Pasta needs salt. Fresh pasta cooks fast.",
    ]);
    expect(similarities).toHaveLength(7);
    for (const c of chunks) expect(text.slice(c.startChar, c.endChar)).toBe(c.content);
  });

  it("still respects the size cap within one topic", async () => {
    const { chunks } = await semanticChunk(text, {
      chunkSize: 6,
      threshold: 0,
      embed,
      count: words,
    });
    expect(chunks.every((c) => c.tokenCount <= 6)).toBe(true);
    expect(chunks.length).toBeGreaterThan(3);
  });

  it("keeps everything together when the threshold is below every similarity", async () => {
    const { chunks } = await semanticChunk(text, {
      chunkSize: 1000,
      threshold: -1,
      embed,
      count: words,
    });
    expect(chunks).toHaveLength(1);
  });
});
