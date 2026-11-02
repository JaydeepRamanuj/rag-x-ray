import { splitSentences } from "./sentence";
import type { Chunk } from "./types";

export type ChunkStats = {
  chunks: number;
  avgTokens: number;
  /** Standard deviation of chunk size: how uneven the chunks are. */
  stdTokens: number;
  minTokens: number;
  maxTokens: number;
  /** Tokens stored across all chunks over tokens in the source: the overlap's cost. */
  duplication: number;
  sentences: number;
  /** Sentences with a chunk boundary inside them, so no chunk holds them whole. */
  cutSentences: number;
};

/**
 * Shape statistics for one way of chunking a text. `sourceTokens` is the
 * count of the whole text, so duplication can be measured against it.
 */
export function chunkStats(text: string, chunks: Chunk[], sourceTokens: number): ChunkStats {
  const sizes = chunks.map((c) => c.tokenCount);
  const n = Math.max(1, sizes.length);
  const total = sizes.reduce((s, x) => s + x, 0);
  const avg = total / n;
  const variance = sizes.reduce((s, x) => s + (x - avg) ** 2, 0) / n;

  const sentences = splitSentences(text)
    .map(({ start, end }) => trimSpan(text, start, end))
    .filter((s) => s.end > s.start);
  const cut = new Set<number>();
  for (const c of chunks) {
    for (const b of [c.startChar, c.endChar]) {
      const i = sentenceAt(sentences, b);
      if (i !== -1) cut.add(i);
    }
  }

  return {
    chunks: sizes.length,
    avgTokens: Math.round(avg),
    stdTokens: Math.round(Math.sqrt(variance)),
    minTokens: sizes.length ? Math.min(...sizes) : 0,
    maxTokens: sizes.length ? Math.max(...sizes) : 0,
    duplication: sourceTokens ? Number((total / sourceTokens).toFixed(2)) : 0,
    sentences: sentences.length,
    cutSentences: cut.size,
  };
}

function trimSpan(text: string, start: number, end: number) {
  const raw = text.slice(start, end);
  const s = start + (raw.length - raw.trimStart().length);
  return { start: s, end: s + raw.trim().length };
}

/** Index of the sentence that offset `at` falls strictly inside, or -1. */
function sentenceAt(sentences: { start: number; end: number }[], at: number): number {
  let lo = 0;
  let hi = sentences.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const s = sentences[mid];
    if (at <= s.start) hi = mid - 1;
    else if (at >= s.end) lo = mid + 1;
    else return mid;
  }
  return -1;
}
