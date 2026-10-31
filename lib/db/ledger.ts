import { getDb } from "./client";
import { ingestUsage } from "./schema";

export type NewIngestUsage = typeof ingestUsage.$inferInsert;

export async function insertIngestUsage(row: NewIngestUsage): Promise<void> {
  await getDb().insert(ingestUsage).values(row);
}
