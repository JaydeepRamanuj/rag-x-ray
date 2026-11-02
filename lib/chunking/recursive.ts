import { estimateTokens } from "@/lib/tokens/count";

import { hardSplit, mergePieces, type Span } from "./spans";
import { checkOptions, type Chunk, type ChunkOptions } from "./types";

export type { Chunk, ChunkOptions } from "./types";

/**
 * Coarsest boundary first. A paragraph break is the best place to cut, a
 * line break next, then a sentence end, then a clause, then a word. Only a
 * single "word" longer than the whole chunk is cut mid-way.
 */
export const SEPARATORS = ["\n\n", "\n", ". ", "? ", "! ", "; ", ", ", " "];

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
  checkOptions(options);

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
