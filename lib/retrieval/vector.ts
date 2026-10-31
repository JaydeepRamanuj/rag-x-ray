import { getSql } from "@/lib/db/client";

export type RetrievedChunk = {
  chunkId: string;
  documentId: string;
  title: string;
  ordinal: number;
  content: string;
  tokenCount: number;
  /** The method's own score. Each method's scale is different (see the lessons). */
  score: number;
};

export type SearchOptions = {
  /**
   * Which chunk sets to search. Omitted, it's each document's active set,
   * the one chat uses; the retrieval arena can point at any saved set.
   */
  chunkSetIds?: string[];
};

export type EmbeddingColumn = "gemini" | "local";

/** pgvector's text input format: '[0.1,0.2,...]'. */
export function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

// Shared by every retrieval query: a NULL id list means "active sets only".
export function scopeIds(options: SearchOptions): string[] | null {
  return options.chunkSetIds?.length ? options.chunkSetIds : null;
}

export function toRetrieved(r: Record<string, unknown>): RetrievedChunk {
  return {
    chunkId: r.chunk_id as string,
    documentId: r.document_id as string,
    title: r.title as string,
    ordinal: r.ordinal as number,
    content: r.content as string,
    tokenCount: r.token_count as number,
    score: Number(r.score),
  };
}

/**
 * Nearest neighbours by cosine distance. `<=>` is pgvector's cosine
 * distance operator (0 = same direction, 2 = opposite); similarity is 1
 * minus that. The query vector must come from the same model as the column.
 *
 * ORDER BY the bare `embedding <=> query` expression with a LIMIT is the
 * shape the HNSW index recognises. Wrap it in arithmetic or sort by the
 * computed score instead and Postgres falls back to scanning every row.
 */
export async function vectorSearch(
  queryVector: number[],
  topK: number,
  options: SearchOptions & { model?: EmbeddingColumn } = {},
): Promise<RetrievedChunk[]> {
  const sql = getSql();
  const q = toVectorLiteral(queryVector);
  const ids = scopeIds(options);
  // Column names can't be query parameters, so each model has its own query.
  const rows =
    options.model === "local"
      ? await sql`
          SELECT c.id AS chunk_id, c.document_id, d.title, c.ordinal, c.content, c.token_count,
                 1 - (c.embedding_local <=> ${q}::vector) AS score
          FROM chunks c
          JOIN chunk_sets cs ON cs.id = c.chunk_set_id
          JOIN documents d ON d.id = c.document_id
          WHERE c.embedding_local IS NOT NULL
            AND (CASE WHEN ${ids}::uuid[] IS NULL THEN cs.is_active ELSE cs.id = ANY(${ids}::uuid[]) END)
          ORDER BY c.embedding_local <=> ${q}::vector
          LIMIT ${topK}
        `
      : await sql`
          SELECT c.id AS chunk_id, c.document_id, d.title, c.ordinal, c.content, c.token_count,
                 1 - (c.embedding <=> ${q}::vector) AS score
          FROM chunks c
          JOIN chunk_sets cs ON cs.id = c.chunk_set_id
          JOIN documents d ON d.id = c.document_id
          WHERE c.embedding IS NOT NULL
            AND (CASE WHEN ${ids}::uuid[] IS NULL THEN cs.is_active ELSE cs.id = ANY(${ids}::uuid[]) END)
          ORDER BY c.embedding <=> ${q}::vector
          LIMIT ${topK}
        `;
  return rows.map(toRetrieved);
}
