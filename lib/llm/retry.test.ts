import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchWithRetry, HttpError, parseRetryAfter } from "./retry";

const noSleep = vi.fn(async () => {});

function mockFetch(...responses: Response[]) {
  const fn = vi.fn();
  responses.forEach((r) => fn.mockResolvedValueOnce(r));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  noSleep.mockClear();
});

describe("parseRetryAfter", () => {
  it("reads seconds from the header", () => {
    expect(parseRetryAfter(new Headers({ "retry-after": "2" }))).toBe(2000);
  });

  it("reads an HTTP date from the header", () => {
    const now = Date.parse("2026-10-31T00:00:00Z");
    const headers = new Headers({ "retry-after": "Sat, 31 Oct 2026 00:00:05 GMT" });
    expect(parseRetryAfter(headers, "", now)).toBe(5000);
  });

  it("reads Google's retryDelay from the error body", () => {
    const body = JSON.stringify({ error: { details: [{ retryDelay: "12.5s" }] } });
    expect(parseRetryAfter(new Headers(), body)).toBe(12_500);
  });

  it("returns undefined when there is no hint", () => {
    expect(parseRetryAfter(new Headers(), "{}")).toBeUndefined();
  });
});

describe("fetchWithRetry", () => {
  it("returns the first successful response", async () => {
    mockFetch(new Response("ok"));
    const { attempts } = await fetchWithRetry("u", {}, { sleep: noSleep });
    expect(attempts).toBe(1);
    expect(noSleep).not.toHaveBeenCalled();
  });

  it("retries 429 and 503, honouring retry-after", async () => {
    const fetchFn = mockFetch(
      new Response("slow down", { status: 429, headers: { "retry-after": "1" } }),
      new Response("busy", { status: 503 }),
      new Response("ok"),
    );
    const onRetry = vi.fn();
    const { attempts } = await fetchWithRetry(
      "u",
      {},
      { sleep: noSleep, random: () => 0.5, baseDelayMs: 100, onRetry },
    );
    expect(attempts).toBe(3);
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(onRetry.mock.calls.map((c) => c[0])).toEqual([
      { attempt: 1, status: 429, delayMs: 1000 }, // from retry-after
      { attempt: 2, status: 503, delayMs: 100 }, // 0.5 * 100 * 2^1
    ]);
  });

  it("does not retry client errors like 400", async () => {
    mockFetch(new Response(JSON.stringify({ error: { message: "bad model" } }), { status: 400 }));
    await expect(fetchWithRetry("u", {}, { sleep: noSleep })).rejects.toThrow("bad model");
    expect(noSleep).not.toHaveBeenCalled();
  });

  it("gives up after maxAttempts", async () => {
    mockFetch(new Response("", { status: 503 }), new Response("", { status: 503 }));
    await expect(
      fetchWithRetry("u", {}, { sleep: noSleep, maxAttempts: 2 }),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it("fails fast when retry-after is longer than the max delay", async () => {
    mockFetch(new Response("", { status: 429, headers: { "retry-after": "3600" } }));
    const error = await fetchWithRetry("u", {}, { sleep: noSleep, maxDelayMs: 30_000 }).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(HttpError);
    expect(error.retryAfterMs).toBe(3_600_000);
    expect(noSleep).not.toHaveBeenCalled();
  });
});
