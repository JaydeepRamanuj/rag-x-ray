import { fixedChunk } from "./fixed";
import { recursiveChunk } from "./recursive";
import { semanticChunk, type SemanticResult } from "./semantic";
import { sentenceChunk } from "./sentence";
import type { Chunk, Strategy } from "./types";

export { STRATEGIES, type Chunk, type Strategy } from "./types";

export type ChunkSettings = {
  strategy: Strategy;
  chunkSize: number;
  overlap: number;
  /** Semantic only. */
  threshold?: number;
};

export type ChunkOutput = {
  chunks: Chunk[];
  /** Semantic only: the neighbour-similarity curve its cuts follow. */
  semantic?: Omit<SemanticResult, "chunks">;
};

/**
 * One entry point for all four strategies. Semantic needs an embedding
 * function; the others are pure and synchronous underneath.
 */
export async function chunkText(
  text: string,
  settings: ChunkSettings,
  embed?: (texts: string[]) => Promise<number[][]>,
): Promise<ChunkOutput> {
  const { strategy, chunkSize, overlap } = settings;
  switch (strategy) {
    case "fixed":
      return { chunks: fixedChunk(text, { chunkSize, overlap }) };
    case "recursive":
      return { chunks: recursiveChunk(text, { chunkSize, overlap }) };
    case "sentence":
      return { chunks: sentenceChunk(text, { chunkSize, overlap }) };
    case "semantic": {
      if (!embed) throw new Error("Semantic chunking needs an embedding model.");
      const { chunks, ...semantic } = await semanticChunk(text, {
        chunkSize,
        threshold: settings.threshold ?? DEFAULT_SEMANTIC_THRESHOLD,
        embed,
      });
      return { chunks, semantic };
    }
  }
}

/**
 * Picked from the similarity curve of this app's own documents with
 * all-MiniLM-L6-v2 (see Lesson 5). It depends on the model: another model
 * spreads its similarities differently and needs its own value.
 */
export const DEFAULT_SEMANTIC_THRESHOLD = 0.4;
