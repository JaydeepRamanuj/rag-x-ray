/** Progress events streamed by /api/ingest, in order. `atMs` is since the request arrived. */
export type IngestEventMap = {
  extracted: {
    atMs: number;
    sourceType: string;
    pages: number | null;
    chars: number;
    tokens: number;
  };
  replacing: { atMs: number; documentId: string; title: string };
  chunked: {
    atMs: number;
    chunks: number;
    avgTokens: number;
    minTokens: number;
    maxTokens: number;
  };
  embedding: {
    atMs: number;
    batch: number;
    batches: number;
    cached: number;
    embedded: number;
    total: number;
    waitMs?: number;
  };
  stored: { atMs: number; documentId: string };
  done: {
    atMs: number;
    documentId: string;
    title: string;
    chunks: number;
    cacheHits: number;
    embeddedTokens: number;
    batches: number;
  };
  error: { atMs: number; message: string };
};

export type IngestEventName = keyof IngestEventMap;

export type IngestEvent = {
  [K in IngestEventName]: { event: K; data: IngestEventMap[K] };
}[IngestEventName];
