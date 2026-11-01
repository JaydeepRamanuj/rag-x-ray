import { describe, expect, it } from "vitest";

import { cosineSimilarity, nearest, nearest2d, truncateVector } from "@/lib/embeddings/vector-math";

import { pca } from "./pca";

describe("pca", () => {
  it("finds the line points lie on and puts nearly all variance there", () => {
    const data = [-2, -1, 0, 1, 2].map((t) => [t, 2 * t, 0.01 * (t % 2)]);
    const { points, explained } = pca(data);
    expect(explained[0]).toBeGreaterThan(0.99);
    // Along the line, spacing is preserved: each step is sqrt(1 + 4).
    expect(points[4][0] - points[3][0]).toBeCloseTo(Math.sqrt(5), 3);
  });

  it("orders components by variance and keeps them orthogonal", () => {
    const data = [
      [3, 0, 0],
      [-3, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
    ];
    const { explained, project } = pca(data);
    expect(explained[0]).toBeCloseTo(0.9, 3);
    expect(explained[1]).toBeCloseTo(0.1, 3);
    expect(Math.abs(project([3, 0, 0])[0])).toBeCloseTo(3, 3);
    expect(project([3, 0, 0])[1]).toBeCloseTo(0, 3);
  });

  it("projects a new point with the same mean and axes", () => {
    const data = [
      [1, 1],
      [2, 2],
      [3, 3],
    ];
    const { points, project } = pca(data, 1);
    expect(project([2, 2])[0]).toBeCloseTo(points[1][0], 6);
    expect(project([2, 2])[0]).toBeCloseTo(0, 6);
  });
});

describe("vector maths", () => {
  it("measures cosine similarity regardless of length", () => {
    expect(cosineSimilarity([1, 0], [5, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 3])).toBeCloseTo(0);
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
    expect(() => cosineSimilarity([1], [1, 2])).toThrow(/mismatch/);
  });

  it("truncates to a prefix and rescales it to unit length", () => {
    const t = truncateVector([3, 4, 12], 2);
    expect(t).toEqual([0.6, 0.8]);
    expect(truncateVector([1, 2], 5)).toEqual([1, 2]);
  });

  it("ranks neighbours by similarity in full dimensions and by distance in 2D", () => {
    const vs = [
      [1, 0],
      [0.9, 0.1],
      [0, 1],
    ];
    expect(nearest([1, 0], vs, 2).map((n) => n.index)).toEqual([0, 1]);
    expect(
      nearest2d(
        [0, 0],
        [
          [5, 5],
          [1, 0],
          [0, 2],
        ],
        2,
      ),
    ).toEqual([1, 2]);
  });
});
