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

export const STRATEGIES = ["fixed", "recursive", "sentence", "semantic"] as const;
export type Strategy = (typeof STRATEGIES)[number];

export function checkOptions({ chunkSize, overlap }: ChunkOptions) {
  if (chunkSize <= 0) throw new Error("chunkSize must be positive");
  if (overlap < 0 || overlap >= chunkSize) throw new Error("overlap must be in [0, chunkSize)");
}
