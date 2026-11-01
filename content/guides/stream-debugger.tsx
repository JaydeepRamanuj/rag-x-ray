import { Term } from "@/components/term";

import type { Guide } from "./types";

export const streamDebuggerGuide: Guide = {
  match: (p) => /^\/runs\/[^/]+\/stream$/.test(p),
  title: "Streaming debugger",
  summary: (
    <p>
      A slow-motion replay of how an answer travels from the model to your screen. Press Replay and
      the same prompt is sent again, while the page records every piece that arrives and when.
    </p>
  ),
  why: (
    <>
      <p>
        Answers appear word by word because they are <Term id="streaming">streamed</Term>: the model
        sends small pieces as it writes, instead of one block at the end. That&apos;s why a 5-second
        answer feels fast. But the pieces, their timing and the waiting before the first one are all
        invisible in chat.
      </p>
      <p>
        <strong>Without this page</strong> &quot;it&apos;s slow&quot; is all you can say. Here you
        can tell whether the wait was before the model started (<Term id="ttft" />
        ), or how fast it wrote once it did (<Term id="tokens-per-second" />
        ), and see a retry after a <Term id="rate-limit" /> instead of an unexplained pause.
      </p>
    </>
  ),
  inputs: [
    {
      name: "Model",
      what: "Replay the saved prompt on this model. Compare how fast each one starts and writes.",
    },
    {
      name: "Slow network (250 ms per read)",
      what: "Makes the browser read the stream slowly, as on a bad connection. Pieces pile up and arrive in bunches.",
    },
    {
      name: "Replay",
      what: "Sends the run's exact prompt again (no new search). Each replay is a real request, saved as a new run.",
    },
  ],
  steps: [
    {
      do: "Press Replay with the normal network.",
      see: "The timeline fills in: sent, headers, first token, last token, end. The wire log scrolls with lines as they arrive, and the answer types itself out on the right.",
    },
    {
      do: "Read the numbers above the timeline.",
      see: "For the example HNSW question: TTFT about 3.2 s, then 105 tokens in about 0.3 s. Almost all the time is waiting for the first word, not writing.",
    },
    {
      do: "Scroll the wire log to the top.",
      see: "event: start, then meta (the provider accepted), then many upstream lines (the provider's raw pieces) each followed by event: token lines, then usage and done.",
    },
    {
      do: "Tick Slow network and Replay again.",
      see: "Fewer reads, each holding several events at once. The text arrives in jumps. Same total tokens, worse experience.",
    },
    {
      do: "Replay on a Groq model.",
      see: "A row per replay in the table at the bottom. Groq usually starts and writes faster; compare TTFT and tokens/s.",
    },
  ],
  reading: [
    {
      name: "Timeline",
      what: "Dots for when the request was sent, headers arrived, the first and last tokens arrived, and the stream ended. The green bar is the writing part.",
    },
    {
      name: "TTFT, tokens/s, total",
      what: "Wait before the first word; writing speed after it; the whole thing.",
    },
    {
      name: "reads",
      what: "How many times the browser received a batch of bytes. On a fast network, about one per event; on a slow one, far fewer.",
    },
    {
      name: "Wire log",
      what: (
        <>
          Every read (with bytes and how many events it held) and every <Term id="sse" /> event.
          &quot;upstream&quot; lines are the raw frames from Gemini or Groq, passed through so you
          can compare them with this app&apos;s own events.
        </>
      ),
    },
    {
      name: "Upstream response headers",
      what: "What the provider sent back first, including Groq's rate-limit counters (requests and tokens left this minute).",
    },
    {
      name: "Replays this session",
      what: "A table comparing every replay you've done here, by model and network.",
    },
  ],
  pros: [
    "Streaming makes answers feel fast: you start reading after the first token, not the last.",
    "Users can stop a bad answer early and stop paying for it.",
    "Each piece is plain text over HTTP, so it's easy to inspect, as this page does.",
  ],
  cons: [
    "More moving parts: events can arrive split across reads, or several in one, and the parser has to handle both.",
    "Errors can happen half-way through, after you've already shown part of an answer.",
    "Token counts and cost are only final at the end of the stream.",
  ],
  surprises: [
    '"Events aren\'t stored with the run": only the answer and numbers are saved, so the wire log is empty until you Replay.',
    "TTFT on the timeline is a little higher than the server's figure. It's measured in your browser, so it includes the network.",
    "One read can hold many events, and one event can be split across two reads. That's normal for streams.",
  ],
  lessons: ["streaming", "llm-api-call"],
  next: { href: "/ledger", label: "Token ledger: what it all costs" },
};
