import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

// The HTTP driver sends each query as one fetch: no connection pool to keep
// alive, which suits serverless functions that may be frozen between requests.
// It uses the pooled URL; migrations use the direct one (see drizzle.config.ts).
function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = neon(url);
  return { client, db: drizzle({ client, schema, casing: "snake_case" }) };
}

let cached: ReturnType<typeof createDb> | undefined;

/** Lazily created so `next build` works without database env vars. */
export function getDb() {
  cached ??= createDb();
  return cached.db;
}

/** The raw tagged-template client, for the SQL we want to keep visible. */
export function getSql() {
  cached ??= createDb();
  return cached.client;
}
