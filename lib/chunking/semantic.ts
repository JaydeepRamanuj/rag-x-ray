import { estimateTokens } from "@/lib/tokens/count";

import { splitSentences } from "./sentence";
import { hardSplit, toChunk, type Span } from "./spans";
import type { Chunk } from "./types";

export type SemanticOptions = {
  /** Hard cap: a chunk is cut here even if the topic hasn't changed. */
  chunkSize: number;
  /** Cut where similarity between neighbouring sentences drops below this. */
  threshold: number;
  /** Unit-length vectors, one per text, so a dot product is cosine similarity. */
  embed: (texts: string[]) => Promise<number[][]>;
  count?: (text: string) => number;
  /**
   * Sentences either side included when embedding each sentence. A lone
   * sentence ("It does.") carries little meaning; a window of three is a
   * steadier signal of what that part of the text is about.
   */
  buffer?: number;
};

export type SemanticResult = {
  chunks: Chunk[];
  /** similarities[i] is between sentence i and i + 1: the curve the cuts follow. */
  similarities: number[];
  /** Offsets of each sentence, so the curve can be drawn against the text. */
  sentences: { start: number; end: number }[];
};

/**
 * Semantic splitting: embed every sentence, compare each with the next, and
 * cut where they stop being alike. Boundaries follow changes of topic
 * rather than a token count, so chunk sizes vary widely. There is no
 * overlap: the point is that a boundary sits where nothing needs repeating.
 *
 * It costs one embedding per sentence, which is why this app runs it on the
 * local model rather than spending the Gemini quota.
 */
export async function semanticChunk(
  text: string,
  options: SemanticOptions,
): Promise<SemanticResult> {
  const { chunkSize, threshold, embed, count = estimateTokens, buffer = 1 } = options;
  if (chunkSize <= 0) throw new Error("chunkSize must be positive");

  const pieces: Span[] = splitSentences(text)
    .filter((s) => text.slice(s.start, s.end).trim())
    .flatMap((s) => {
      const tokens = count(text.slice(s.start, s.end));
      return tokens <= chunkSize ? [{ ...s, tokens }] : hardSplit(text, s, chunkSize, count);
    });
  if (pieces.length === 0) return { chunks: [], similarities: [], sentences: [] };

  const windows = pieces.map((_, i) => {
    const from = pieces[Math.max(0, i - buffer)].start;
    const to = pieces[Math.min(pieces.length - 1, i + buffer)].end;
    return text.slice(from, to).trim();
  });
  const vectors = await embed(windows);
  const similarities = vectors.slice(1).map((v, i) => dot(vectors[i], v));

  const chunks: Chunk[] = [];
  let start = 0;
  let tokens = pieces[0].tokens;
  const flush = (end: number) => {
    const chunk = toChunk(text, pieces[start].start, pieces[end].end, count);
    if (chunk) chunks.push(chunk);
  };
  for (let i = 1; i < pieces.length; i++) {
    if (similarities[i - 1] < threshold || tokens + pieces[i].tokens > chunkSize) {
      flush(i - 1);
      start = i;
      tokens = 0;
    }
    tokens += pieces[i].tokens;
  }
  flush(pieces.length - 1);

  return {
    chunks,
    similarities: similarities.map((s) => Number(s.toFixed(4))),
    sentences: pieces.map(({ start, end }) => ({ start, end })),
  };
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
