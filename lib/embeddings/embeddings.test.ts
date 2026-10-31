import { describe, expect, it } from "vitest";

import { decodeVector, encodeVector } from "@/lib/cache";

import { normalize, toBatchBody } from "./gemini";
import { embeddingCacheKey, planBatches } from "./index";

describe("normalize", () => {
  it("scales a vector to unit length", () => {
    const v = normalize([3, 4]);
    expect(v[0]).toBeCloseTo(0.6);
    expect(v[1]).toBeCloseTo(0.8);
  });

  it("leaves a zero vector alone instead of dividing by zero", () => {
    expect(normalize([0, 0])).toEqual([0, 0]);
  });
});

describe("toBatchBody", () => {
  it("sends one request per text with task type and 768 dims", () => {
    const body = toBatchBody(["a", "b"], "RETRIEVAL_DOCUMENT");
    expect(body.requests).toHaveLength(2);
    expect(body.requests[0]).toMatchObject({
      model: "models/gemini-embedding-001",
      content: { parts: [{ text: "a" }] },
      taskType: "RETRIEVAL_DOCUMENT",
      outputDimensionality: 768,
    });
  });
});

describe("vector codec", () => {
  it("round-trips through base64 Float32 with float32 precision", () => {
    const v = [0.1, -0.25, 0.333333, 1];
    decodeVector(encodeVector(v)).forEach((x, i) => expect(x).toBeCloseTo(v[i], 6));
  });
});

describe("embeddingCacheKey", () => {
  it("differs by task type and by text", () => {
    const a = embeddingCacheKey("hello", "RETRIEVAL_DOCUMENT");
    expect(a).not.toBe(embeddingCacheKey("hello", "RETRIEVAL_QUERY"));
    expect(a).not.toBe(embeddingCacheKey("hello!", "RETRIEVAL_DOCUMENT"));
    expect(a).toBe(embeddingCacheKey("hello", "RETRIEVAL_DOCUMENT"));
  });
});

describe("planBatches", () => {
  it("splits by item count", () => {
    expect(planBatches([1, 1, 1, 1, 1], 2, 100)).toEqual([[0, 1], [2, 3], [4]]);
  });

  it("splits by token budget", () => {
    expect(planBatches([60, 30, 20, 90], 10, 100)).toEqual([[0, 1], [2], [3]]);
  });

  it("still sends an item bigger than the budget, alone", () => {
    expect(planBatches([500, 10], 10, 100)).toEqual([[0], [1]]);
  });
});
