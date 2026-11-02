import type { Chunk } from "./types";

/** A piece of the source text, by offsets, with its token count. */
export type Span = { start: number; end: number; tokens: number };

/** Last resort for text with no usable boundary (a URL, a base64 blob). */
export function hardSplit(
  text: string,
  span: { start: number; end: number },
  chunkSize: number,
  count: (t: string) => number,
): Span[] {
  const out: Span[] = [];
  let start = span.start;
  while (start < span.end) {
    const end = longestFit(text, start, span.end, chunkSize, count);
    out.push({ start, end, tokens: count(text.slice(start, end)) });
    start = end;
  }
  return out;
}

/**
 * The furthest end offset such that text[start, end) still fits in
 * `maxTokens`, found by binary search. Always advances by at least one
 * character, so a caller looping on it can't get stuck.
 */
export function longestFit(
  text: string,
  start: number,
  limit: number,
  maxTokens: number,
  count: (t: string) => number,
): number {
  let lo = start + 1;
  let hi = limit;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (count(text.slice(start, mid)) <= maxTokens) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * Packs consecutive pieces into chunks of at most `chunkSize` tokens, then
 * starts the next chunk a few pieces back so neighbours share `overlap`
 * tokens. Pieces are never cut here, so a chunk always starts and ends on a
 * piece boundary (a sentence, a paragraph).
 */
export function mergePieces(
  text: string,
  pieces: Span[],
  chunkSize: number,
  overlap: number,
  count: (t: string) => number,
): Chunk[] {
  const chunks: Chunk[] = [];
  let i = 0;
  while (i < pieces.length) {
    // Summing piece counts is an approximation (tokens can merge across a
    // boundary), but it's close and avoids re-tokenising on every step.
    let j = i;
    let tokens = 0;
    while (j < pieces.length && (j === i || tokens + pieces[j].tokens <= chunkSize)) {
      tokens += pieces[j].tokens;
      j++;
    }

    const chunk = toChunk(text, pieces[i].start, pieces[j - 1].end, count);
    if (chunk) chunks.push(chunk);
    if (j >= pieces.length) break;

    // Walk back from the end of this chunk while the overlap budget allows,
    // but always move forward by at least one piece.
    let next = j;
    let back = 0;
    while (next - 1 > i && back + pieces[next - 1].tokens <= overlap) {
      back += pieces[next - 1].tokens;
      next--;
    }
    i = next;
  }
  return chunks;
}

/** A chunk for text[start, end), trimmed, with offsets moved to match. */
export function toChunk(
  text: string,
  start: number,
  end: number,
  count: (t: string) => number,
): Chunk | undefined {
  const raw = text.slice(start, end);
  const content = raw.trim();
  if (!content) return undefined;
  const lead = raw.length - raw.trimStart().length;
  const startChar = start + lead;
  return { content, startChar, endChar: startChar + content.length, tokenCount: count(content) };
}
