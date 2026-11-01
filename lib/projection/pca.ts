import { dot, norm } from "@/lib/embeddings/vector-math";

export type Pca = {
  /** The data projected onto the top components. */
  points: number[][];
  /** Share of the total variance each component explains, 0 to 1. */
  explained: number[];
  /** Projects a new vector (same dimensions) into the same 2D space. */
  project: (v: number[]) => number[];
};

/**
 * Principal component analysis by power iteration: the directions in which
 * the data spreads out most, found one at a time. Each round multiplies a
 * guess by the covariance matrix, which stretches it towards the widest
 * direction; then that direction is removed and the next one is found.
 *
 * The covariance matrix is never built (768 × 768 for Gemini). Multiplying
 * by it is the same as Xᵀ(X v) / (n − 1) on the centred data, which costs
 * two passes over the rows.
 *
 * Unlike UMAP, PCA is linear and deterministic: distances along each axis
 * mean something, but clusters that differ in a non-linear way overlap.
 */
export function pca(data: number[][], components = 2, iterations = 200): Pca {
  const n = data.length;
  const dims = data[0]?.length ?? 0;
  const mean = new Array<number>(dims).fill(0);
  for (const row of data) for (let d = 0; d < dims; d++) mean[d] += row[d] / n;
  const centred = data.map((row) => row.map((x, d) => x - mean[d]));

  let totalVariance = 0;
  for (const row of centred) totalVariance += dot(row, row) / Math.max(1, n - 1);

  const axes: number[][] = [];
  const variances: number[] = [];
  for (let c = 0; c < components; c++) {
    // A fixed, uneven start so results are the same on every render.
    let v = Array.from({ length: dims }, (_, d) => 1 + ((d * 7919) % 13) / 13);
    v = unit(orthogonalise(v, axes));
    let eigenvalue = 0;
    for (let it = 0; it < iterations; it++) {
      const scores = centred.map((row) => dot(row, v));
      const next = new Array<number>(dims).fill(0);
      centred.forEach((row, i) => {
        for (let d = 0; d < dims; d++) next[d] += (row[d] * scores[i]) / Math.max(1, n - 1);
      });
      const w = orthogonalise(next, axes);
      eigenvalue = norm(w);
      if (eigenvalue === 0) break;
      v = w.map((x) => x / eigenvalue);
    }
    // An eigenvector's sign is arbitrary; pin it so the plot doesn't flip.
    const anchor = v.reduce((best, x) => (Math.abs(x) > Math.abs(best) ? x : best), 0);
    axes.push(anchor < 0 ? v.map((x) => -x) : v);
    variances.push(eigenvalue);
  }

  const project = (row: number[]) => axes.map((a) => dot(a, row) - dot(a, mean));
  return {
    points: data.map(project),
    explained: variances.map((ev) => (totalVariance === 0 ? 0 : ev / totalVariance)),
    project,
  };
}

/** Removes the parts of v that point along the axes already found. */
function orthogonalise(v: number[], axes: number[][]): number[] {
  let out = v;
  for (const a of axes) {
    const along = dot(out, a);
    out = out.map((x, d) => x - along * a[d]);
  }
  return out;
}

function unit(v: number[]): number[] {
  const n = norm(v);
  return n === 0 ? v : v.map((x) => x / n);
}
