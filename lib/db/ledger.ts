import { desc } from "drizzle-orm";

import { getDb, getSql } from "./client";
import type { Run } from "./runs";
import { ingestUsage, runs } from "./schema";

export type NewIngestUsage = typeof ingestUsage.$inferInsert;

export async function insertIngestUsage(row: NewIngestUsage): Promise<void> {
  await getDb().insert(ingestUsage).values(row);
}

export async function listRuns(limit: number): Promise<Run[]> {
  return getDb().select().from(runs).orderBy(desc(runs.createdAt)).limit(limit);
}

/** Gemini's daily quotas reset at midnight Pacific, so days are counted there. */
export const QUOTA_TIME_ZONE = "America/Los_Angeles";

export type ModelDay = {
  day: string; // YYYY-MM-DD, Pacific
  model: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
  /** Query embeddings that missed the cache, i.e. real embedding calls. */
  embedRequests: number;
  embedTokens: number;
  /** The busiest single minute that day, for comparing with per-minute limits. */
  peakRpm: number;
  peakTpm: number;
};

export type IngestDay = { day: string; uploads: number; requests: number; embedTokens: number };

/**
 * Per-day usage for the last `days` days. The SQL stays raw so the
 * bucketing is visible: AT TIME ZONE turns each timestamp into Pacific wall
 * time before the date is taken, and the inner query finds each day's
 * busiest minute.
 */
export async function dailyUsage(
  days: number,
): Promise<{ models: ModelDay[]; ingest: IngestDay[] }> {
  const sql = getSql();
  const tz = QUOTA_TIME_ZONE;
  const since = `${days} days`;
  const [models, ingest] = await Promise.all([
    sql`
      WITH per_minute AS (
        SELECT (created_at AT TIME ZONE ${tz})::date AS day,
               config->>'model' AS model,
               date_trunc('minute', created_at) AS minute,
               count(*) AS requests,
               sum(coalesce(input_tokens, 0) + coalesce(output_tokens, 0)) AS tokens,
               sum(coalesce(input_tokens, 0)) AS input,
               sum(coalesce(output_tokens, 0)) AS output,
               sum(coalesce(cached_tokens, 0)) AS cached,
               sum(coalesce(reasoning_tokens, 0)) AS reasoning,
               count(*) FILTER (WHERE embed_tokens > 0) AS embed_requests,
               sum(coalesce(embed_tokens, 0)) AS embed_tokens
        FROM runs
        WHERE created_at > now() - ${since}::interval
        GROUP BY 1, 2, 3
      )
      SELECT day::text, model,
             sum(requests)::int AS requests,
             sum(input)::int AS input_tokens,
             sum(output)::int AS output_tokens,
             sum(cached)::int AS cached_tokens,
             sum(reasoning)::int AS reasoning_tokens,
             sum(embed_requests)::int AS embed_requests,
             sum(embed_tokens)::int AS embed_tokens,
             max(requests)::int AS peak_rpm,
             max(tokens)::int AS peak_tpm
      FROM per_minute
      GROUP BY 1, 2
      ORDER BY 1, 2
    `,
    sql`
      SELECT (created_at AT TIME ZONE ${tz})::date::text AS day,
             count(*)::int AS uploads,
             sum(requests)::int AS requests,
             sum(embed_tokens)::int AS embed_tokens
      FROM ingest_usage
      WHERE created_at > now() - ${since}::interval
      GROUP BY 1
      ORDER BY 1
    `,
  ]);
  return {
    models: models.map((r) => ({
      day: r.day,
      model: r.model,
      requests: r.requests,
      inputTokens: r.input_tokens,
      outputTokens: r.output_tokens,
      cachedTokens: r.cached_tokens,
      reasoningTokens: r.reasoning_tokens,
      embedRequests: r.embed_requests,
      embedTokens: r.embed_tokens,
      peakRpm: r.peak_rpm,
      peakTpm: r.peak_tpm,
    })),
    ingest: ingest.map((r) => ({
      day: r.day,
      uploads: r.uploads,
      requests: r.requests,
      embedTokens: r.embed_tokens,
    })),
  };
}
