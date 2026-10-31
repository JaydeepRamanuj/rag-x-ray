import { eq } from "drizzle-orm";

import { getDb } from "./client";
import { runs } from "./schema";

export type NewRun = typeof runs.$inferInsert;
export type Run = typeof runs.$inferSelect;

export async function insertRun(run: NewRun): Promise<void> {
  await getDb().insert(runs).values(run);
}

export async function getRun(id: string): Promise<Run | undefined> {
  // Not a valid uuid: Postgres would throw on the cast, so short-circuit.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  const [run] = await getDb().select().from(runs).where(eq(runs.id, id)).limit(1);
  return run;
}
