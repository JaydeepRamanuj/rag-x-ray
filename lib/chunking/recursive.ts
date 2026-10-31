import { estimateTokens } from "@/lib/tokens/count";

export type Chunk = {
  content: string;
  /** Offsets into the source text, so the UI can highlight the chunk. */
  startChar: number;
  endChar: number;
  tokenCount: number;
};

export type ChunkOptions = {
  /** Target maximum size of a chunk, in tokens. */
  chunkSize: number;
  /** Tokens of the previous chunk repeated at the start of the next one. */
  overlap: number;
  count?: (text: string) => number;
};

/**
 * Coarsest boundary first. A paragraph break is the best place to cut, a
 * line break next, then a sentence end, then a clause, then a word. Only a
 * single "word" longer than the whole chunk is cut mid-way.
 */
export const SEPARATORS = ["\n\n", "\n", ". ", "? ", "! ", "; ", ", ", " "];

type Span = { start: number; end: number; tokens: number };

/**
 * Recursive character splitting, the default strategy in most RAG stacks:
 *   1. Split the text on the coarsest separator.
 *   2. Any piece still bigger than chunkSize is split again on the next one.
 *   3. Merge neighbouring pieces back together until a chunk is full.
 *   4. Start the next chunk a few pieces back, so they overlap.
 * Pieces are always spans of the original text, so offsets stay exact.
 */
export function recursiveChunk(text: string, options: ChunkOptions): Chunk[] {
  const { chunkSize, overlap, count = estimateTokens } = options;
  if (chunkSize <= 0) throw new Error("chunkSize must be positive");
  if (overlap < 0 || overlap >= chunkSize) throw new Error("overlap must be in [0, chunkSize)");

  const pieces = splitSpan(text, { start: 0, end: text.length }, 0, chunkSize, count);
  return mergePieces(text, pieces, chunkSize, overlap, count);
}

function splitSpan(
  text: string,
  span: { start: number; end: number },
  level: number,
  chunkSize: number,
  count: (t: string) => number,
): Span[] {
  const tokens = count(text.slice(span.start, span.end));
  if (tokens <= chunkSize) return [{ ...span, tokens }];
  if (level >= SEPARATORS.length) return hardSplit(text, span, chunkSize, count);

  const separator = SEPARATORS[level];
  const parts: { start: number; end: number }[] = [];
  let cursor = span.start;
  for (;;) {
    const at = text.indexOf(separator, cursor);
    if (at === -1 || at >= span.end) break;
    // The separator stays attached to the piece before it, so pieces tile
    // the text with no gaps and a sentence keeps its full stop.
    const end = at + separator.length;
    parts.push({ start: cursor, end });
    cursor = end;
  }
  if (cursor < span.end) parts.push({ start: cursor, end: span.end });
  if (parts.length === 1) return splitSpan(text, span, level + 1, chunkSize, count);

  return parts.flatMap((part) => splitSpan(text, part, level + 1, chunkSize, count));
}

/** Last resort for text with no usable separator (a URL, a base64 blob). */
function hardSplit(
  text: string,
  span: { start: number; end: number },
  chunkSize: number,
  count: (t: string) => number,
): Span[] {
  const out: Span[] = [];
  let start = span.start;
  while (start < span.end) {
    // Binary search for the longest prefix that fits.
    let lo = start + 1;
    let hi = span.end;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (count(text.slice(start, mid)) <= chunkSize) lo = mid;
      else hi = mid - 1;
    }
    out.push({ start, end: lo, tokens: count(text.slice(start, lo)) });
    start = lo;
  }
  return out;
}

function mergePieces(
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

function toChunk(
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
