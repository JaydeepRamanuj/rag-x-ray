/**
 * Plain vector maths, safe to import in the browser. The embedding explorer
 * and the similarity playground do their nearest-neighbour search here, in
 * full dimensions, so the 2D picture can be checked against the real thing.
 */

export function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

export function norm(v: number[]): number {
  return Math.sqrt(dot(v, v));
}

/** Cosine similarity: the dot product of the two directions, from -1 to 1. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error(`Dimension mismatch: ${a.length} vs ${b.length}`);
  const n = norm(a) * norm(b);
  return n === 0 ? 0 : dot(a, b) / n;
}

/**
 * Matryoshka truncation. gemini-embedding-001 is trained so that the first
 * N numbers of a vector are a usable N-dim embedding on their own, so a
 * 256-dim vector is the first 256 of the 768 we store. The prefix is
 * shorter than length 1 (about 0.65 on our chunks), so it is rescaled.
 */
export function truncateVector(v: number[], dims: number): number[] {
  if (dims >= v.length) return v;
  const prefix = v.slice(0, dims);
  const n = norm(prefix);
  return n === 0 ? prefix : prefix.map((x) => x / n);
}

export type Neighbour = { index: number; similarity: number };

/** The k most similar vectors to `query`, by exact cosine (no index). */
export function nearest(query: number[], vectors: number[][], k: number): Neighbour[] {
  return vectors
    .map((v, index) => ({ index, similarity: cosineSimilarity(query, v) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);
}

/** The k closest points to `p` in the 2D projection, by straight-line distance. */
export function nearest2d(p: [number, number], points: [number, number][], k: number): number[] {
  return points
    .map((q, index) => ({ index, d: Math.hypot(q[0] - p[0], q[1] - p[1]) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, k)
    .map((x) => x.index);
}
