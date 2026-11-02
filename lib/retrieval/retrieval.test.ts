import { describe, expect, it } from "vitest";

import { reciprocalRankFusion } from "./hybrid";
import { applyRerank, rerankCacheKey } from "./rerank";
import type { RetrievedChunk } from "./vector";

const chunk = (id: string, score = 0): RetrievedChunk => ({
  chunkId: id,
  documentId: "d",
  title: "doc",
  ordinal: 0,
  content: id,
  tokenCount: 1,
  score,
});
const list = (...ids: string[]) => ids.map((id) => chunk(id, 0.9));

describe("reciprocalRankFusion", () => {
  it("sums 1 / (k + rank) across lists", () => {
    const [top] = reciprocalRankFusion([list("a", "b"), list("b", "a")], 5, 60);
    expect(top.score).toBeCloseTo(1 / 61 + 1 / 62);
  });

  it("puts a chunk found by both lists above one that tops only one", () => {
    const fused = reciprocalRankFusion([list("a", "b", "c"), list("x", "y", "b")], 5);
    expect(fused[0].chunkId).toBe("b");
    expect(fused[0].ranks).toEqual([2, 3]);
  });

  it("records a missing rank as null and keeps topK", () => {
    const fused = reciprocalRankFusion([list("a", "b", "c"), list("d")], 2);
    expect(fused).toHaveLength(2);
    expect(fused.find((c) => c.chunkId === "a")?.ranks).toEqual([1, null]);
  });

  it("ignores raw scores entirely", () => {
    const a = [chunk("a", 0.99), chunk("b", 0.01)];
    const b = [chunk("b", 500), chunk("a", 1)];
    const fused = reciprocalRankFusion([a, b], 2);
    expect(fused[0].score).toBeCloseTo(fused[1].score);
    // A tie goes to the first list's order.
    expect(fused.map((c) => c.chunkId)).toEqual(["a", "b"]);
  });

  it("with a small k, a single first place wins over agreement", () => {
    const lists = [list("a", "b", "x"), list("c", "y", "b")];
    expect(reciprocalRankFusion(lists, 1, 0)[0].chunkId).toBe("a");
    expect(reciprocalRankFusion(lists, 1, 60)[0].chunkId).toBe("b");
  });
});

describe("applyRerank", () => {
  it("reorders candidates by Cohere's result list and keeps the old rank", () => {
    const candidates = list("a", "b", "c");
    const out = applyRerank(
      candidates,
      [
        { index: 2, relevance_score: 0.9 },
        { index: 0, relevance_score: 0.5 },
        { index: 1, relevance_score: 0.1 },
      ],
      2,
    );
    expect(out.map((c) => [c.chunkId, c.score, c.previousRank])).toEqual([
      ["c", 0.9, 3],
      ["a", 0.5, 1],
    ]);
  });

  it("keys the cache on the query and the exact candidate order", () => {
    expect(rerankCacheKey("q", ["a", "b"])).not.toBe(rerankCacheKey("q", ["b", "a"]));
    expect(rerankCacheKey("q", ["a"])).toBe(rerankCacheKey("q", ["a"]));
  });
});
