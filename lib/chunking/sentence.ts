import { estimateTokens } from "@/lib/tokens/count";

import { hardSplit, mergePieces, type Span } from "./spans";
import { checkOptions, type Chunk, type ChunkOptions } from "./types";

// Intl.Segmenter ends a sentence after any full stop followed by a space,
// so "Dr. Smith" becomes two sentences. These are glued back together.
const ABBREVIATION = /\b(?:Dr|Mr|Mrs|Ms|Prof|Sr|Jr|St|vs|etc|Fig|No|Inc|Ltd|approx)\.\s*$/i;

/**
 * The text as a list of sentence spans that tile it with no gaps.
 * Intl.Segmenter implements the Unicode sentence-boundary rules (UAX #29),
 * which handle "e.g.", decimals like 3.5 and ?! endings, and treat a line
 * break as the end of a sentence too, so headings and list items come out
 * as sentences of their own.
 */
export function splitSentences(text: string): { start: number; end: number }[] {
  const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
  const spans: { start: number; end: number }[] = [];
  for (const { index, segment } of segmenter.segment(text)) {
    const end = index + segment.length;
    const prev = spans.at(-1);
    // A blank line comes back as its own "sentence"; it belongs to the one before.
    const blank = !segment.trim();
    if (prev && (blank || ABBREVIATION.test(text.slice(prev.start, prev.end)))) {
      prev.end = end;
    } else {
      spans.push({ start: index, end });
    }
  }
  return spans;
}

/**
 * Sentence splitting: pack whole sentences into each chunk until the next
 * one wouldn't fit. Overlap is whole sentences too. Only a sentence longer
 * than a chunk (a giant table row, a code block) is cut, by tokens.
 *
 * Unlike recursive splitting, it ignores paragraphs: a chunk can end on the
 * first sentence of a new section.
 */
export function sentenceChunk(text: string, options: ChunkOptions): Chunk[] {
  const { chunkSize, overlap, count = estimateTokens } = options;
  checkOptions(options);

  const pieces: Span[] = splitSentences(text).flatMap((s) => {
    const tokens = count(text.slice(s.start, s.end));
    return tokens <= chunkSize ? [{ ...s, tokens }] : hardSplit(text, s, chunkSize, count);
  });
  return mergePieces(text, pieces, chunkSize, overlap, count);
}
