import { describe, expect, it } from "vitest";

import { chatModels, limits } from "@/lib/config";

import { batches, itemDelayMs, judgeDelayMs, remainingWork } from "./plan";
import type { ItemResult, RunConfig } from "./types";

const base: RunConfig = {
  mode: "retrieval",
  chunking: "active",
  method: "vector",
  rerank: false,
  topK: 5,
  embedding: "gemini",
  chatModel: chatModels.geminiFlashLite.id,
  judgeModel: chatModels.geminiFlash.id,
  chunkSetIds: [],
  itemIds: ["a", "b", "c", "d", "e", "f", "g"],
};

const item = (itemId: string, extra: Partial<ItemResult> = {}): ItemResult => ({
  itemId,
  question: itemId,
  retrieved: [],
  hitRank: 1,
  retrievalMs: 1,
  ...extra,
});

describe("delays", () => {
  it("doesn't wait between retrieval-only questions", () => {
    expect(itemDelayMs(base)).toBe(0);
  });

  it("paces reranking to Cohere's 10 calls a minute", () => {
    expect(itemDelayMs({ ...base, rerank: true })).toBe(6_500);
  });

  it("paces answers to the chat model and keeps the configured floor", () => {
    expect(itemDelayMs({ ...base, mode: "full" })).toBeGreaterThanOrEqual(limits.evalDelayMs);
  });

  it("paces the judge to its 5 requests a minute", () => {
    expect(judgeDelayMs(chatModels.geminiFlash.id)).toBe(12_500);
  });
});

describe("remainingWork", () => {
  it("is every item, and no judging, for a new retrieval run", () => {
    expect(remainingWork({ config: base, results: { items: [], judgeCalls: [] } })).toEqual({
      itemIds: base.itemIds,
      judgeBatches: [],
    });
  });

  it("batches a new full run's judging", () => {
    const work = remainingWork({
      config: { ...base, mode: "full" },
      results: { items: [], judgeCalls: [] },
    });
    expect(work.judgeBatches).toEqual(batches(base.itemIds, limits.judgeBatchSize));
  });

  it("resumes: retries errors, skips judged items, judges answered ones", () => {
    const work = remainingWork({
      config: { ...base, mode: "full", itemIds: ["a", "b", "c", "d"] },
      results: {
        items: [
          item("a", { answer: "x", faithfulness: 5, relevance: 5 }),
          item("b", { answer: "y" }),
          item("c", { error: "429" }),
        ],
        judgeCalls: [],
      },
    });
    expect(work.itemIds).toEqual(["c", "d"]);
    expect(work.judgeBatches.flat()).toEqual(["b", "c", "d"]);
  });
});
