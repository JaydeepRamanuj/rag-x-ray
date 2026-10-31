import { describe, expect, it } from "vitest";

import { chatModels, estimateCostUsd } from "@/lib/config";

import { embedCostUsd, whatIfCost, type RunForWhatIf } from "./cost";

// A Gemini RAG run whose provider count came in 10% above our estimate.
const run: RunForWhatIf = {
  provider: "gemini",
  inputTokens: 2_200,
  outputTokens: 150,
  cachedTokens: 0,
  embedTokens: 8,
  promptEstimate: 2_000,
  sourceEstimate: 1_800, // 5 chunks of 360
  sourceCount: 5,
  prefixEstimate: 100,
};
const lite = chatModels.geminiFlashLite;

describe("whatIfCost", () => {
  it("reproduces the run's own tokens when nothing changes", () => {
    const r = whatIfCost(run, { model: lite, topK: 5, cachePrefix: false });
    expect(r.inputTokens).toBe(2_200);
    expect(r.outputTokens).toBe(150);
    expect(r.chatUsd).toBeCloseTo(
      estimateCostUsd(lite.price, { inputTokens: 2_200, outputTokens: 150 }),
      12,
    );
    expect(r.approximate).toBe(false);
  });

  it("scales sources with top-k and applies the run's own ratio", () => {
    // (2000 - 1800 + 10 * 360) * 1.1 = 4180
    const r = whatIfCost(run, { model: lite, topK: 10, cachePrefix: false });
    expect(r.inputTokens).toBe(4_180);
  });

  it("uses the chosen chunk size instead of the actual average", () => {
    // (200 + 5 * 800) * 1.1 = 4620
    const r = whatIfCost(run, { model: lite, topK: 5, chunkSize: 800, cachePrefix: false });
    expect(r.inputTokens).toBe(4_620);
  });

  it("falls back to the raw estimate for another provider, and says so", () => {
    const r = whatIfCost(run, { model: chatModels.groqSmall, topK: 5, cachePrefix: false });
    expect(r.inputTokens).toBe(2_000);
    expect(r.approximate).toBe(true);
  });

  it("prices the stable prefix at the cached rate when caching is on", () => {
    const r = whatIfCost(run, { model: lite, topK: 5, cachePrefix: true });
    expect(r.cachedTokens).toBe(110);
    expect(r.chatUsd).toBeLessThan(
      whatIfCost(run, { model: lite, topK: 5, cachePrefix: false }).chatUsd,
    );
  });

  it("ignores top-k for a run that had no retrieval", () => {
    const raw = { ...run, sourceEstimate: 0, sourceCount: 0 };
    expect(whatIfCost(raw, { model: lite, topK: 20, cachePrefix: false }).inputTokens).toBe(2_200);
  });

  it("adds the query embedding to the total", () => {
    const r = whatIfCost(run, { model: lite, topK: 5, cachePrefix: false });
    expect(r.embedUsd).toBeCloseTo(embedCostUsd(8), 12);
    expect(r.totalUsd).toBeCloseTo(r.chatUsd + r.embedUsd, 12);
  });
});
