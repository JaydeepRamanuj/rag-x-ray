import { and, count, desc, eq, sum } from "drizzle-orm";

import { getDb } from "./client";
import { chunks, chunkSets, documents } from "./schema";

export type DocumentRow = {
  id: string;
  title: string;
  sourceType: string;
  tokenCount: number;
  pageCount: number | null;
  chunkCount: number;
  createdAt: Date | null;
};

export async function listDocuments(): Promise<DocumentRow[]> {
  return (
    getDb()
      .select({
        id: documents.id,
        title: documents.title,
        sourceType: documents.sourceType,
        tokenCount: documents.tokenCount,
        pageCount: documents.pageCount,
        chunkCount: count(chunks.id),
        createdAt: documents.createdAt,
      })
      .from(documents)
      // Only the active set: the chunking lab can save more sets of the same
      // document, and counting those too made build-plan.md show 42, not 17.
      .leftJoin(
        chunkSets,
        and(eq(chunkSets.documentId, documents.id), eq(chunkSets.isActive, true)),
      )
      .leftJoin(chunks, eq(chunks.chunkSetId, chunkSets.id))
      .groupBy(documents.id)
      .orderBy(desc(documents.createdAt))
  );
}

export async function totalTokens(): Promise<number> {
  const [row] = await getDb()
    .select({ total: sum(documents.tokenCount) })
    .from(documents);
  return Number(row?.total ?? 0);
}

export async function findDocumentByHash(hash: string) {
  const [row] = await getDb()
    .select({ id: documents.id, title: documents.title, tokenCount: documents.tokenCount })
    .from(documents)
    .where(eq(documents.contentHash, hash))
    .limit(1);
  return row;
}

/** Chunk sets and chunks go too, through ON DELETE CASCADE. */
export async function deleteDocument(id: string): Promise<boolean> {
  const rows = await getDb()
    .delete(documents)
    .where(eq(documents.id, id))
    .returning({ id: documents.id });
  return rows.length > 0;
}

export type NewChunk = {
  ordinal: number;
  content: string;
  tokenCount: number;
  startChar: number;
  endChar: number;
  embedding: number[];
  embeddingLocal?: number[];
};

/**
 * Writes the document, its chunk set and every chunk in one round trip.
 * The neon-http driver can't hold a transaction open across awaits, but
 * db.batch() sends all statements together and runs them in a single
 * transaction, so a failure leaves nothing half-written. IDs are generated
 * here so later statements can reference earlier rows.
 */
export async function insertDocumentWithChunks(input: {
  title: string;
  sourceType: string;
  rawText: string;
  tokenCount: number;
  contentHash: string;
  pageCount: number | null;
  strategy: string;
  chunkSize: number;
  overlap: number;
  chunks: NewChunk[];
}): Promise<{ documentId: string; chunkSetId: string }> {
  const db = getDb();
  const documentId = crypto.randomUUID();
  const chunkSetId = crypto.randomUUID();

  const chunkInserts = [];
  // Several statements rather than one giant one keep each under the
  // driver's request size comfortably.
  for (let i = 0; i < input.chunks.length; i += 50) {
    chunkInserts.push(
      db
        .insert(chunks)
        .values(input.chunks.slice(i, i + 50).map((c) => ({ ...c, chunkSetId, documentId }))),
    );
  }

  await db.batch([
    db.insert(documents).values({
      id: documentId,
      title: input.title,
      sourceType: input.sourceType,
      rawText: input.rawText,
      tokenCount: input.tokenCount,
      contentHash: input.contentHash,
      pageCount: input.pageCount,
    }),
    db.insert(chunkSets).values({
      id: chunkSetId,
      documentId,
      strategy: input.strategy,
      chunkSize: input.chunkSize,
      overlap: input.overlap,
      isActive: true,
    }),
    ...chunkInserts,
  ]);

  return { documentId, chunkSetId };
}
