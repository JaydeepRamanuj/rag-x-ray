import { connection } from "next/server";

import { getSql } from "@/lib/db/client";

type Check = { ok: boolean; ms: number; detail?: string; error?: string };

async function timed(fn: () => Promise<string | undefined>): Promise<Check> {
  const start = performance.now();
  try {
    const detail = await fn();
    return { ok: true, ms: Math.round(performance.now() - start), detail };
  } catch (err) {
    return {
      ok: false,
      ms: Math.round(performance.now() - start),
      // Message only: driver errors can embed the connection string.
      error:
        err instanceof Error
          ? err.message.replace(/postgres(ql)?:\/\/\S+/g, "[redacted]")
          : "unknown error",
    };
  }
}

export async function GET() {
  // Without this, Cache Components would try to prerender the health check at
  // build time and serve a frozen answer forever.
  await connection();

  // The first query after Neon has been idle for ~5 minutes wakes the compute,
  // so its latency is the "cold start" the later debugger pages label.
  const database = await timed(async () => {
    const [row] = await getSql()`select version() as version`;
    return String(row.version).split(" ").slice(0, 2).join(" ");
  });

  const pgvector = await timed(async () => {
    const rows = await getSql()`select extversion from pg_extension where extname = 'vector'`;
    if (rows.length === 0) throw new Error("pgvector extension is not installed");
    return `v${rows[0].extversion}`;
  });

  const ok = database.ok && pgvector.ok;
  return Response.json(
    { ok, checks: { database, pgvector }, time: new Date().toISOString() },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
