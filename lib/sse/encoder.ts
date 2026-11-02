const encoder = new TextEncoder();

/**
 * Formats one SSE event. Data is JSON, so it is normally a single line, but
 * any newline is still split into separate `data:` lines: a raw newline
 * inside one data line would end the event early on the client.
 */
export function formatSse(event: string, data: unknown): string {
  const json = JSON.stringify(data);
  const dataLines = json
    .split(/\r\n|\r|\n/)
    .map((line) => `data: ${line}`)
    .join("\n");
  return `event: ${event}\n${dataLines}\n\n`;
}

export function encodeSse(event: string, data: unknown): Uint8Array {
  return encoder.encode(formatSse(event, data));
}

export const sseHeaders = {
  "content-type": "text/event-stream; charset=utf-8",
  // no-transform stops proxies from gzipping, which would buffer the stream.
  "cache-control": "no-cache, no-transform",
  // Tells nginx-style proxies not to buffer the response.
  "x-accel-buffering": "no",
  connection: "keep-alive",
} as const;
