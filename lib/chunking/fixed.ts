import { estimateTokens } from "@/lib/tokens/count";

import { longestFit, toChunk } from "./spans";
import { checkOptions, type Chunk, type ChunkOptions } from "./types";

/**
 * Fixed-size splitting: fill each chunk to exactly `chunkSize` tokens and
 * cut, wherever that lands. Mid-sentence, mid-word, between a heading and
 * its paragraph. It's the baseline every other strategy is measured against:
 * the simplest thing that works, and the one that cuts the most sentences.
 *
 * The next chunk starts `overlap` tokens before this one ended.
 */
export function fixedChunk(text: string, options: ChunkOptions): Chunk[] {
  const { chunkSize, overlap, count = estimateTokens } = options;
  checkOptions(options);

  const chunks: Chunk[] = [];
  let start = 0;
  while (start < text.length) {
    const end = longestFit(text, start, text.length, chunkSize, count);
    const chunk = toChunk(text, start, end, count);
    if (chunk) chunks.push(chunk);
    if (end >= text.length) break;
    start = overlap > 0 ? overlapStart(text, start, end, overlap, count) : end;
  }
  return chunks;
}

/**
 * Where the next chunk should begin so it repeats about `overlap` tokens:
 * the latest offset whose suffix up to `end` still holds that many. Never
 * at or before `prevStart`, so the loop always moves forward.
 */
function overlapStart(
  text: string,
  prevStart: number,
  end: number,
  overlap: number,
  count: (t: string) => number,
): number {
  let lo = prevStart + 1;
  let hi = end;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (count(text.slice(mid, end)) >= overlap) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
