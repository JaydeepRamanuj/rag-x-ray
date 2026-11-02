import { limits } from "@/lib/config";

/** 429 is rate limiting; 5xx are usually transient (Gemini sends 503 when a model is busy). */
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

export type RetryInfo = { attempt: number; status: number; delayMs: number };

export type RetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (info: RetryInfo) => void;
  /** Injectable so tests don't wait for real time. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  random?: () => number;
};

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
    readonly retryAfterMs?: number,
  ) {
    super(`HTTP ${status}: ${summariseErrorBody(body)}`);
    this.name = "HttpError";
  }
}

/** Pulls the human-readable message out of a provider's JSON error body. */
function summariseErrorBody(body: string): string {
  try {
    const parsed = JSON.parse(body);
    const err = Array.isArray(parsed) ? parsed[0]?.error : parsed.error;
    if (typeof err?.message === "string") return err.message;
  } catch {
    // not JSON
  }
  return body.slice(0, 300);
}

/**
 * How long the server asked us to wait, in ms. Groq sends a `retry-after`
 * header in seconds; HTTP also allows a date. Google puts a `retryDelay` like
 * "12s" inside the JSON error body instead.
 */
export function parseRetryAfter(headers: Headers, body = "", now = Date.now()): number | undefined {
  const header = headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const date = Date.parse(header);
    if (!Number.isNaN(date)) return Math.max(0, date - now);
  }
  const match = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(body);
  if (match) return Number(match[1]) * 1000;
  return undefined;
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(signal?.reason);
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * fetch with exponential backoff. Only the request is retried, never a stream
 * that has already started: once tokens have reached the user, replaying the
 * request would duplicate them.
 *
 * Delay before retry n (0-based) is the server's retry-after when given,
 * otherwise "full jitter": a random value in [0, base * 2^n]. Jitter stops many
 * clients that failed together from all retrying at the same instant.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options: RetryOptions = {},
): Promise<{ response: Response; attempts: number }> {
  const {
    maxAttempts = limits.retry.maxAttempts,
    baseDelayMs = limits.retry.baseDelayMs,
    maxDelayMs = limits.retry.maxDelayMs,
    onRetry,
    sleep: wait = sleep,
    random = Math.random,
  } = options;
  const signal = init.signal ?? undefined;

  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, init);
    if (response.ok) return { response, attempts: attempt };

    const body = await response.text();
    const retryAfterMs = parseRetryAfter(response.headers, body);
    const error = new HttpError(response.status, body, retryAfterMs);

    if (!RETRYABLE.has(response.status) || attempt >= maxAttempts) throw error;
    // A long retry-after usually means a daily quota is used up. Waiting
    // inside a request would hit the function timeout, so fail fast instead.
    if (retryAfterMs !== undefined && retryAfterMs > maxDelayMs) throw error;

    const backoff = random() * Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
    const delayMs = Math.round(retryAfterMs ?? backoff);
    onRetry?.({ attempt, status: response.status, delayMs });
    await wait(delayMs, signal);
  }
}
