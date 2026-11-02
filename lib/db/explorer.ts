import { getSql } from "./client";

export type ChunkPoint = {
  chunkId: string;
  documentId: string;
  title: string;
  ordinal: number;
  tokenCount: number;
  /** The first few hundred characters, for the hover card. */
  preview: string;
  vector: number[];
};

/**
 * Every active chunk with its stored vector, for the embedding explorer.
 * pgvector prints a vector as '[0.1,0.2,...]', which is valid JSON, so the
 * text cast is parsed directly. About 9.6 KB per Gemini vector: fine for the
 * ~64 chunks here, but a library of thousands would need sampling.
 */
export async function activeChunkVectors(model: "gemini" | "local"): Promise<ChunkPoint[]> {
  const sql = getSql();
  // Column names can't be parameters, so each model has its own query.
  const rows =
    model === "local"
      ? await sql`
          SELECT c.id, c.document_id, d.title, c.ordinal, c.token_count,
                 left(c.content, 280) AS preview, c.embedding_local::text AS vector
          FROM chunks c
          JOIN chunk_sets cs ON cs.id = c.chunk_set_id
          JOIN documents d ON d.id = c.document_id
          WHERE cs.is_active AND c.embedding_local IS NOT NULL
          ORDER BY d.title, c.ordinal
        `
      : await sql`
          SELECT c.id, c.document_id, d.title, c.ordinal, c.token_count,
                 left(c.content, 280) AS preview, c.embedding::text AS vector
          FROM chunks c
          JOIN chunk_sets cs ON cs.id = c.chunk_set_id
          JOIN documents d ON d.id = c.document_id
          WHERE cs.is_active AND c.embedding IS NOT NULL
          ORDER BY d.title, c.ordinal
        `;
  return rows.map((r) => ({
    chunkId: r.id as string,
    documentId: r.document_id as string,
    title: r.title as string,
    ordinal: r.ordinal as number,
    tokenCount: r.token_count as number,
    preview: r.preview as string,
    vector: JSON.parse(r.vector as string) as number[],
  }));
}
