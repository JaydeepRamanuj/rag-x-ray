import { createHash } from "node:crypto";

import { Redis } from "@upstash/redis";

/**
 * Upstash Redis over HTTP: each command is one fetch, so it works from
 * serverless functions without holding a TCP connection open.
 * Without credentials the cache turns itself off rather than failing, so
 * the app still runs (just slower and with more API calls).
 */
let client: Redis | null | undefined;

function redis(): Redis | null {
  if (client === undefined) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    client = url && token ? new Redis({ url, token }) : null;
  }
  return client;
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * Vectors are stored as base64 Float32 bytes: 768 floats take 3 KB this way
 * versus ~8 KB as JSON text. That matters on a 256 MB free tier.
 */
export function encodeVector(vector: number[]): string {
  return Buffer.from(new Float32Array(vector).buffer).toString("base64");
}

export function decodeVector(encoded: string): number[] {
  const bytes = Buffer.from(encoded, "base64");
  return Array.from(new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4));
}

/** One MGET for the whole batch: one command against the monthly quota. */
export async function getMany(keys: string[]): Promise<(string | null)[]> {
  const r = redis();
  if (!r || keys.length === 0) return keys.map(() => null);
  try {
    // Upstash auto-parses JSON-looking values; ours are base64 so they stay strings.
    return await r.mget<(string | null)[]>(...keys);
  } catch (err) {
    console.warn("cache read failed:", err instanceof Error ? err.message : err);
    return keys.map(() => null);
  }
}

/** Writes in a single pipelined request. A failed write only costs a future miss. */
export async function setMany(entries: [string, string][], ttlSeconds: number): Promise<void> {
  const r = redis();
  if (!r || entries.length === 0) return;
  try {
    const pipeline = r.pipeline();
    for (const [key, value] of entries) pipeline.set(key, value, { ex: ttlSeconds });
    await pipeline.exec();
  } catch (err) {
    console.warn("cache write failed:", err instanceof Error ? err.message : err);
  }
}

export function cacheEnabled(): boolean {
  return redis() !== null;
}
