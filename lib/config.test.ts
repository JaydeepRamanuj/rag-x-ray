import { describe, expect, it } from "vitest";

import { chatModels, estimateCostUsd, getChatModel } from "./config";

describe("estimateCostUsd", () => {
  const price = { input: 1, cachedInput: 0.1, output: 4 };

  it("prices input and output per million tokens", () => {
    expect(estimateCostUsd(price, { inputTokens: 1_000_000, outputTokens: 500_000 })).toBe(3);
  });

  it("bills cached tokens at the cached rate, not on top of input", () => {
    // 600k uncached * $1 + 400k cached * $0.10 = $0.64
    const cost = estimateCostUsd(price, {
      inputTokens: 1_000_000,
      cachedTokens: 400_000,
      outputTokens: 0,
    });
    expect(cost).toBeCloseTo(0.64, 10);
  });

  it("falls back to the input rate when a model has no cached price", () => {
    const cost = estimateCostUsd(
      { input: 2, output: 2 },
      { inputTokens: 500_000, cachedTokens: 500_000, outputTokens: 0 },
    );
    expect(cost).toBe(1);
  });
});

describe("getChatModel", () => {
  it("finds a model by provider ID", () => {
    expect(getChatModel(chatModels.groqLarge.id).provider).toBe("groq");
  });

  it("throws on an unknown ID so typos fail loudly", () => {
    expect(() => getChatModel("not-a-model")).toThrow(/Unknown chat model/);
  });
});
