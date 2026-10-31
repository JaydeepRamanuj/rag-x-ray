import { and, asc, eq, ne } from "drizzle-orm";

import type { Chunk, ChunkSettings } from "@/lib/chunking";
import { toVectorLiteral } from "@/lib/retrieval/vector";

import { getDb, getSql } from "./client";
import { chunks, chunkSets, documents } from "./schema";

export type ChunkSetRow = {
  id: string;
  documentId: string;
  title: string;
  strategy: string;
  chunkSize: number | null;
  overlap: number | null;
  threshold: number | null;
  isActive: boolean;
  chunks: number;
  avgTokens: number;
  /** Chunks that have a vector in each column, so missing ones can be filled in. */
  withGemini: number;
  withLocal: number;
  createdAt: string;
};

/** Every chunk set with its size and embedding coverage, newest first per document. */
export async function listChunkSets(documentId?: string): Promise<ChunkSetRow[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT cs.id, cs.document_id, d.title, cs.strategy, cs.chunk_size, cs.overlap, cs.threshold,
           cs.is_active, cs.created_at,
           count(c.id)::int AS chunks,
           coalesce(round(avg(c.token_count)), 0)::int AS avg_tokens,
           count(c.embedding)::int AS with_gemini,
           count(c.embedding_local)::int AS with_local
    FROM chunk_sets cs
    JOIN documents d ON d.id = cs.document_id
    LEFT JOIN chunks c ON c.chunk_set_id = cs.id
    WHERE ${documentId ?? null}::uuid IS NULL OR cs.document_id = ${documentId ?? null}::uuid
    GROUP BY cs.id, d.title
    ORDER BY d.title, cs.is_active DESC, cs.created_at DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    documentId: r.document_id,
    title: r.title,
    strategy: r.strategy,
    chunkSize: r.chunk_size,
    overlap: r.overlap,
    threshold: r.threshold,
    isActive: Boolean(r.is_active),
    chunks: r.chunks,
    avgTokens: r.avg_tokens,
    withGemini: r.with_gemini,
    withLocal: r.with_local,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export async function getDocumentText(id: string) {
  const [row] = await getDb()
    .select({ id: documents.id, title: documents.title, rawText: documents.rawText })
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);
  return row;
}

/**
 * Stores a new, inactive chunk set with its chunks, in one transaction
 * (db.batch). Chat keeps using the old active set until this one is made
 * active, so saving an experiment never changes answers by itself.
 */
export async function insertChunkSet(input: {
  documentId: string;
  settings: ChunkSettings;
  chunks: (Chunk & { embedding?: number[]; embeddingLocal?: number[] })[];
}): Promise<string> {
  const db = getDb();
  const chunkSetId = crypto.randomUUID();
  const { strategy, chunkSize, overlap, threshold } = input.settings;
  const rows = input.chunks.map((c, i) => ({
    chunkSetId,
    documentId: input.documentId,
    ordinal: i,
    content: c.content,
    tokenCount: c.tokenCount,
    startChar: c.startChar,
    endChar: c.endChar,
    embedding: c.embedding,
    embeddingLocal: c.embeddingLocal,
  }));
  const inserts = [];
  for (let i = 0; i < rows.length; i += 50) {
    inserts.push(db.insert(chunks).values(rows.slice(i, i + 50)));
  }
  await db.batch([
    db.insert(chunkSets).values({
      id: chunkSetId,
      documentId: input.documentId,
      strategy,
      chunkSize,
      overlap: strategy === "semantic" ? 0 : overlap,
      threshold: strategy === "semantic" ? threshold : null,
      isActive: false,
    }),
    ...inserts,
  ]);
  return chunkSetId;
}

/** Makes one set the document's active set and every other set inactive, atomically. */
export async function activateChunkSet(id: string): Promise<boolean> {
  const db = getDb();
  const [set] = await db
    .select({ documentId: chunkSets.documentId })
    .from(chunkSets)
    .where(eq(chunkSets.id, id));
  if (!set?.documentId) return false;
  await db.batch([
    db
      .update(chunkSets)
      .set({ isActive: false })
      .where(and(eq(chunkSets.documentId, set.documentId), ne(chunkSets.id, id))),
    db.update(chunkSets).set({ isActive: true }).where(eq(chunkSets.id, id)),
  ]);
  return true;
}

/** Refuses the active set: a document without one would drop out of chat. */
export async function deleteChunkSet(id: string): Promise<"deleted" | "active" | "missing"> {
  const db = getDb();
  const [set] = await db
    .select({ isActive: chunkSets.isActive })
    .from(chunkSets)
    .where(eq(chunkSets.id, id));
  if (!set) return "missing";
  if (set.isActive) return "active";
  await db.delete(chunkSets).where(eq(chunkSets.id, id));
  return "deleted";
}

/** Chunks of a set still missing a vector in the given column, in order. */
export async function chunksMissing(chunkSetId: string, column: "gemini" | "local") {
  const db = getDb();
  const rows = await db
    .select({
      id: chunks.id,
      content: chunks.content,
      embedding: column === "gemini" ? chunks.embedding : chunks.embeddingLocal,
    })
    .from(chunks)
    .where(eq(chunks.chunkSetId, chunkSetId))
    .orderBy(asc(chunks.ordinal));
  return rows.filter((r) => r.embedding === null).map(({ id, content }) => ({ id, content }));
}

/**
 * Writes many vectors in one statement: unnest() turns two parallel arrays
 * into rows to join against, instead of one UPDATE per chunk.
 */
export async function setEmbeddings(
  column: "gemini" | "local",
  ids: string[],
  vectors: number[][],
): Promise<void> {
  if (ids.length === 0) return;
  const sql = getSql();
  const literals = vectors.map(toVectorLiteral);
  if (column === "gemini") {
    await sql`
      UPDATE chunks c SET embedding = v.e::vector
      FROM unnest(${ids}::uuid[], ${literals}::text[]) AS v(id, e)
      WHERE c.id = v.id
    `;
  } else {
    await sql`
      UPDATE chunks c SET embedding_local = v.e::vector
      FROM unnest(${ids}::uuid[], ${literals}::text[]) AS v(id, e)
      WHERE c.id = v.id
    `;
  }
}
