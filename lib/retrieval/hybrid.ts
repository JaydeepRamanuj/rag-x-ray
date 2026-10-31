import { defaults } from "@/lib/config";

import type { RetrievedChunk } from "./vector";

export type FusedChunk = RetrievedChunk & {
  /** 1-based rank in each input list, or null where that list missed it. */
  ranks: (number | null)[];
};

/**
 * Reciprocal Rank Fusion (Cormack et al., 2009):
 *
 *   score(chunk) = Σ over lists of 1 / (k + rank in that list)
 *
 * Only ranks are used, never the raw scores, which is the point: a cosine
 * similarity of 0.7 and a ts_rank of 0.3 aren't on the same scale, and
 * normalising them is fiddly and fragile. A chunk near the top of both
 * lists beats one at the top of only one. k = 60 damps the gap between
 * rank 1 and rank 2 so that agreement counts for more than a single win.
 */
export function reciprocalRankFusion(
  lists: RetrievedChunk[][],
  topK: number,
  k: number = defaults.rrfK,
): FusedChunk[] {
  const fused = new Map<string, FusedChunk>();
  lists.forEach((list, li) => {
    list.forEach((chunk, i) => {
      const entry =
        fused.get(chunk.chunkId) ??
        ({ ...chunk, score: 0, ranks: lists.map(() => null) } as FusedChunk);
      entry.ranks[li] = i + 1;
      entry.score += 1 / (k + i + 1);
      fused.set(chunk.chunkId, entry);
    });
  });
  // Ties (same ranks, mirrored) go to the better best rank, then to the first list.
  return [...fused.values()]
    .sort(
      (a, b) =>
        b.score - a.score ||
        bestRank(a) - bestRank(b) ||
        (a.ranks[0] ?? Infinity) - (b.ranks[0] ?? Infinity),
    )
    .slice(0, topK);
}

function bestRank(c: FusedChunk): number {
  return Math.min(...c.ranks.map((r) => r ?? Infinity));
}
