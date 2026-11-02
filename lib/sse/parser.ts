/**
 * A hand-written Server-Sent Events parser, used on both sides of the wire:
 * the server reads Gemini's and Groq's upstream streams with it, and the
 * browser reads our own /api/chat stream with it.
 *
 * The wire format (https://html.spec.whatwg.org/multipage/server-sent-events.html):
 *   event: token        <- optional event name, defaults to "message"
 *   data: {"text":"Hi"} <- one or more data lines, joined with "\n"
 *   id: 7               <- optional
 *   : comment           <- lines starting with ":" are ignored (keep-alives)
 *                       <- a blank line ends the event
 *
 * Network chunks don't respect any of this: one read() can hold half an event,
 * or three events and the first half of a fourth. So the parser buffers text
 * and only emits an event once its terminating blank line has arrived.
 */

export type SseEvent = {
  event: string;
  data: string;
  id?: string;
};

export class SseParser {
  private buffer = "";
  private event = "";
  private data: string[] = [];
  private id: string | undefined;

  /** Feed decoded text; returns every event completed by this chunk. */
  feed(chunk: string): SseEvent[] {
    this.buffer += chunk;
    const events: SseEvent[] = [];

    for (;;) {
      const match = /\r\n|\r|\n/.exec(this.buffer);
      if (!match) break;
      // A chunk can end between the "\r" and "\n" of a CRLF. Wait for the next
      // chunk, or the "\n" would later be read as a second, blank line.
      if (match[0] === "\r" && match.index === this.buffer.length - 1) break;

      const line = this.buffer.slice(0, match.index);
      this.buffer = this.buffer.slice(match.index + match[0].length);
      const event = this.processLine(line);
      if (event) events.push(event);
    }
    return events;
  }

  /** Call when the stream ends: a final event without a trailing blank line still counts. */
  flush(): SseEvent[] {
    const events: SseEvent[] = [];
    if (this.buffer) {
      const event = this.processLine(this.buffer);
      this.buffer = "";
      if (event) events.push(event);
    }
    const last = this.dispatch();
    if (last) events.push(last);
    return events;
  }

  /** Characters received but not yet part of a complete line. */
  get pending(): number {
    return this.buffer.length;
  }

  private processLine(line: string): SseEvent | undefined {
    if (line === "") return this.dispatch();
    if (line.startsWith(":")) return undefined;

    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);

    if (field === "event") this.event = value;
    else if (field === "data") this.data.push(value);
    else if (field === "id") this.id = value;
    // "retry" and unknown fields are ignored, as the spec says.
    return undefined;
  }

  private dispatch(): SseEvent | undefined {
    // Per spec, an event with no data lines is dropped.
    if (this.data.length === 0) {
      this.event = "";
      return undefined;
    }
    const event: SseEvent = { event: this.event || "message", data: this.data.join("\n") };
    if (this.id !== undefined) event.id = this.id;
    this.event = "";
    this.data = [];
    return event;
  }
}

/** Details of each network read, for the streaming debugger. */
export type ReadInfo = { bytes: number; events: number; pendingChars: number };

/**
 * Turns a byte stream into SSE events. TextDecoder runs in streaming mode
 * because a multi-byte UTF-8 character (an emoji, "₹") can be split across
 * two reads.
 */
export async function* readSse(
  body: ReadableStream<Uint8Array>,
  onRead?: (info: ReadInfo) => void | Promise<void>,
): AsyncGenerator<SseEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = new SseParser();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const events = parser.feed(decoder.decode(value, { stream: true }));
      await onRead?.({
        bytes: value.byteLength,
        events: events.length,
        pendingChars: parser.pending,
      });
      yield* events;
    }
    yield* parser.feed(decoder.decode());
    yield* parser.flush();
  } finally {
    // Runs on early exit too (break, throw, abort), so the connection is released.
    reader.releaseLock();
  }
}
