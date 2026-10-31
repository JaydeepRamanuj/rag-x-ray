import { describe, expect, it } from "vitest";

import {
  compareRank,
  firstHitRank,
  isHit,
  reciprocalRank,
  sourceCoverage,
  summarize,
  words,
} from "./metrics";

const source = "The default ef_search is 40. Higher values improve recall at the cost of speed.";

describe("words", () => {
  it("drops markdown and punctuation", () => {
    expect(words("**HNSW** (graph-based) `ef_search`!")).toEqual([
      "hnsw",
      "graph",
      "based",
      "ef",
      "search",
    ]);
  });
});

describe("sourceCoverage", () => {
  it("is 1 when the chunk contains the passage, whatever the formatting", () => {
    const chunk = `Intro text.\n\nThe **default** ef_search is 40.\nHigher values improve recall at the cost of speed. More.`;
    expect(sourceCoverage(chunk, source)).toBe(1);
  });

  it("is partial when a chunk boundary cuts the passage", () => {
    const firstHalf = "Some setup. The default ef_search is 40. Higher values";
    const c = sourceCoverage(firstHalf, source);
    expect(c).toBeGreaterThan(0.3);
    expect(c).toBeLessThan(0.6);
  });

  it("is 0 for unrelated text and for an empty source", () => {
    expect(sourceCoverage("Chunking splits text into passages.", source)).toBe(0);
    expect(sourceCoverage("anything", "")).toBe(0);
  });

  it("falls back to single words for a very short source", () => {
    expect(sourceCoverage("uses RRF here", "RRF")).toBe(1);
  });
});

describe("firstHitRank", () => {
  it("returns the 1-based rank of the first chunk holding the source", () => {
    const chunks = ["unrelated", `prefix ${source}`, source];
    expect(firstHitRank(chunks, source)).toBe(2);
  });

  it("returns null when no chunk holds enough of it", () => {
    expect(firstHitRank(["unrelated", "The default ef_search"], source)).toBeNull();
  });

  it("respects the threshold", () => {
    expect(isHit("The default ef_search is 40.", source, 0.2)).toBe(true);
    expect(isHit("The default ef_search is 40.", source)).toBe(false);
  });
});

describe("summarize", () => {
  it("computes hit rate and MRR over every item", () => {
    const s = summarize([{ hitRank: 1 }, { hitRank: 2 }, { hitRank: null }, { hitRank: 4 }]);
    expect(s.hitRate).toBe(0.75);
    expect(s.mrr).toBeCloseTo((1 + 0.5 + 0 + 0.25) / 4);
    expect(s.faithfulness).toBeNull();
  });

  it("averages judge scores only over judged items", () => {
    const s = summarize([
      { hitRank: 1, faithfulness: 5, relevance: 4 },
      { hitRank: 1, faithfulness: 3, relevance: null },
      { hitRank: 1 },
    ]);
    expect(s.faithfulness).toBe(4);
    expect(s.answerRelevance).toBe(4);
  });

  it("returns nulls for an empty run", () => {
    expect(summarize([])).toEqual({
      hitRate: null,
      mrr: null,
      faithfulness: null,
      answerRelevance: null,
    });
  });
});

describe("reciprocalRank and compareRank", () => {
  it("scores ranks", () => {
    expect(reciprocalRank(1)).toBe(1);
    expect(reciprocalRank(4)).toBe(0.25);
    expect(reciprocalRank(null)).toBe(0);
  });

  it("labels how a question moved between runs", () => {
    expect(compareRank(null, 3)).toBe("fixed");
    expect(compareRank(2, null)).toBe("broke");
    expect(compareRank(3, 1)).toBe("better");
    expect(compareRank(1, 2)).toBe("worse");
    expect(compareRank(2, 2)).toBe("same");
    expect(compareRank(null, null)).toBe("same");
  });
});
