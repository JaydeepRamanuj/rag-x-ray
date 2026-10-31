import { getSql } from "@/lib/db/client";

export type RetrievedChunk = {
  chunkId: string;
  documentId: string;
  title: string;
  ordinal: number;
  content: string;
  tokenCount: number;
  /** Cosine similarity, 1 = same direction, 0 = unrelated. */
  score: number;
};

/** pgvector's text input format: '[0.1,0.2,...]'. */
export function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

/**
 * Nearest neighbours by cosine distance, searching only the active chunk set
 * of each document. `<=>` is pgvector's cosine distance operator (0 = same
 * direction, 2 = opposite); similarity is 1 minus that.
 *
 * ORDER BY the bare `embedding <=> query` expression with a LIMIT is the
 * shape the HNSW index recognises. Wrap it in arithmetic or sort by the
 * computed score instead and Postgres falls back to scanning every row.
 */
export async function vectorSearch(queryVector: number[], topK: number): Promise<RetrievedChunk[]> {
  const sql = getSql();
  const q = toVectorLiteral(queryVector);
  const rows = await sql`
    SELECT c.id AS chunk_id, c.document_id, d.title, c.ordinal, c.content, c.token_count,
           1 - (c.embedding <=> ${q}::vector) AS score
    FROM chunks c
    JOIN chunk_sets cs ON cs.id = c.chunk_set_id AND cs.is_active
    JOIN documents d ON d.id = c.document_id
    WHERE c.embedding IS NOT NULL
    ORDER BY c.embedding <=> ${q}::vector
    LIMIT ${topK}
  `;
  return rows.map((r) => ({
    chunkId: r.chunk_id,
    documentId: r.document_id,
    title: r.title,
    ordinal: r.ordinal,
    content: r.content,
    tokenCount: r.token_count,
    score: Number(r.score),
  }));
}
