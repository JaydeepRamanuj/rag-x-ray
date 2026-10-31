import { eq } from "drizzle-orm";

import { getDb } from "./client";
import { runChunks, runs } from "./schema";

export type NewRun = typeof runs.$inferInsert;
export type NewRunChunk = typeof runChunks.$inferInsert;
export type Run = typeof runs.$inferSelect;

/** The run and the chunks it retrieved, in one transaction. */
export async function insertRun(run: NewRun, chunks: NewRunChunk[] = []): Promise<void> {
  const db = getDb();
  if (chunks.length === 0) {
    await db.insert(runs).values(run);
    return;
  }
  await db.batch([db.insert(runs).values(run), db.insert(runChunks).values(chunks)]);
}

export async function getRun(id: string): Promise<Run | undefined> {
  // Not a valid uuid: Postgres would throw on the cast, so short-circuit.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  const [run] = await getDb().select().from(runs).where(eq(runs.id, id)).limit(1);
  return run;
}
