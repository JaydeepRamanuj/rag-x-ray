import { describe, expect, it } from "vitest";

import { formatSse } from "./encoder";
import { readSse, SseParser } from "./parser";

describe("SseParser", () => {
  it("parses a complete event", () => {
    const p = new SseParser();
    expect(p.feed('event: token\ndata: {"text":"hi"}\n\n')).toEqual([
      { event: "token", data: '{"text":"hi"}' },
    ]);
  });

  it("defaults the event name to message", () => {
    expect(new SseParser().feed("data: x\n\n")).toEqual([{ event: "message", data: "x" }]);
  });

  it("buffers an event split across chunks", () => {
    const p = new SseParser();
    expect(p.feed("event: tok")).toEqual([]);
    expect(p.feed("en\ndata: hel")).toEqual([]);
    expect(p.feed("lo\n")).toEqual([]);
    expect(p.feed("\n")).toEqual([{ event: "token", data: "hello" }]);
  });

  it("returns several events from one chunk", () => {
    const events = new SseParser().feed("data: a\n\ndata: b\n\ndata: c");
    expect(events.map((e) => e.data)).toEqual(["a", "b"]);
  });

  it("joins multiple data lines with newlines", () => {
    expect(new SseParser().feed("data: one\ndata: two\n\n")[0].data).toBe("one\ntwo");
  });

  it("handles CRLF line endings, including a CRLF split across chunks", () => {
    const p = new SseParser();
    expect(p.feed("data: a\r")).toEqual([]);
    expect(p.feed("\n\r\n")).toEqual([{ event: "message", data: "a" }]);
  });

  it("ignores comments, unknown fields and data-less events", () => {
    const p = new SseParser();
    expect(p.feed(": keep-alive\n\nretry: 1000\nfoo: bar\n\nevent: x\n\n")).toEqual([]);
  });

  it("strips only one leading space from values", () => {
    expect(new SseParser().feed("data:  two spaces\n\n")[0].data).toBe(" two spaces");
  });

  it("keeps the id field", () => {
    expect(new SseParser().feed("id: 7\ndata: x\n\n")[0]).toEqual({
      event: "message",
      data: "x",
      id: "7",
    });
  });

  it("flushes a final event that has no trailing blank line", () => {
    const p = new SseParser();
    p.feed("data: [DONE]");
    expect(p.flush()).toEqual([{ event: "message", data: "[DONE]" }]);
  });

  it("round-trips the encoder, including newlines inside data", () => {
    const data = { text: "line 1\nline 2" };
    const [event] = new SseParser().feed(formatSse("token", data));
    expect(JSON.parse(event.data)).toEqual(data);
  });
});

describe("readSse", () => {
  function streamOf(chunks: Uint8Array[]) {
    return new ReadableStream<Uint8Array>({
      start(c) {
        chunks.forEach((chunk) => c.enqueue(chunk));
        c.close();
      },
    });
  }

  it("decodes a multi-byte character split across reads", async () => {
    const bytes = new TextEncoder().encode("data: ₹0\n\n");
    // "₹" is 3 bytes starting at index 6; split in the middle of it.
    const stream = streamOf([bytes.slice(0, 7), bytes.slice(7)]);
    const events = [];
    for await (const e of readSse(stream)) events.push(e);
    expect(events).toEqual([{ event: "message", data: "₹0" }]);
  });

  it("reports each read for the debugger", async () => {
    const enc = new TextEncoder();
    const reads: { events: number }[] = [];
    const stream = streamOf([enc.encode("data: a\n\ndata: b\n\ndata: "), enc.encode("c\n\n")]);
    for await (const _ of readSse(stream, (r) => void reads.push(r))) void _;
    expect(reads.map((r) => r.events)).toEqual([2, 1]);
  });
});
