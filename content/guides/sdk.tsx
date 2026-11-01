import { Term } from "@/components/term";

import type { Guide } from "./types";

export const sdkGuide: Guide = {
  match: (p) => p === "/lab/sdk",
  title: "Library comparison",
  summary: (
    <p>
      The same chat built twice: once by hand (this app&apos;s own code), once with the Vercel AI{" "}
      <Term id="sdk" />, a popular library. The left side shows both versions&apos; code; the Race
      sends one question to both at the same moment so you can compare what comes back.
    </p>
  ),
  why: (
    <>
      <p>
        Most real projects use a library to talk to LLMs rather than writing the requests by hand.
        This app hand-wrote everything so each step is visible. This page answers the obvious
        follow-up: what would a library have saved, and what would it have hidden?
      </p>
      <p>
        <strong>Without it</strong> the choice between &quot;use a library&quot; and &quot;write it
        yourself&quot; is a matter of taste. Here it&apos;s measured: lines of code, the bytes on
        the wire, and the information each version can and can&apos;t give you.
      </p>
    </>
  ),
  inputs: [
    {
      name: "File list (left)",
      what: "Click a file to read it. Hand-rolled has 8 files; the SDK version has 1. Line counts skip blank lines and comments.",
    },
    {
      name: "Question and Model (Race)",
      what: "Both lanes use exactly these, with vector search and the top 5 chunks, so the only difference is the code that talks to the model.",
    },
    {
      name: "Race",
      what: "Sends the question to both versions at once. Each answer is a real run, saved and listed in the ledger.",
    },
  ],
  steps: [
    {
      do: "Look at the two code totals at the top.",
      see: "Hand-rolled: 8 files, 709 lines of code. SDK: 1 file, 208 lines. The SDK version still does retrieval, the prompt and saving; what disappears is the provider plumbing.",
    },
    {
      do: "Click lib/sse/parser.ts on the hand-rolled side.",
      see: "Code that reads the provider's stream piece by piece. In the SDK version, all of that is one function call.",
    },
    {
      do: "Press Race.",
      see: "Two lanes filling in at once. Both bill the same input tokens (1,961 for the default question), because they send the same prompt.",
    },
    {
      do: "Press Race a second time and compare first-token times.",
      see: "Which one wins can flip: once 4.06 s vs 4.53 s, next time 1.55 s vs 5.12 s. That's the provider's own speed varying, not the library.",
    },
    {
      do: "Open Wire format on both lanes.",
      see: (
        <>
          Ours sends named events (<code>event: token</code>); the SDK sends typed JSON parts and
          ends with <code>data: [DONE]</code>. Ours is bigger (10.4 KB vs 1.7 KB) only because it
          includes the full source texts for the inspector.
        </>
      ),
    },
  ],
  reading: [
    {
      name: "Code lines",
      what: "Lines of code only, not counting blanks or comments, so the two sides compare fairly.",
    },
    {
      name: "First token, total",
      what: (
        <>
          <Term id="ttft" /> and the full time, measured in your browser for each lane.
        </>
      ),
    },
    {
      name: "Events, bytes",
      what: (
        <>
          How many <Term id="sse" /> messages arrived and how big the whole stream was.
        </>
      ),
    },
    {
      name: "Input, output tokens",
      what: (
        <>
          From each version&apos;s usage report. Input should match exactly; output varies with each
          answer.
        </>
      ),
    },
    {
      name: "Inspect run",
      what: "Opens that lane's saved run in the prompt inspector.",
    },
  ],
  pros: [
    "The SDK: far less code, one way to call every provider, and retries, parsing and usage built in.",
    "The SDK: switching from Gemini to Groq is a one-word change.",
    "Hand-rolled: every byte and header is yours to see and show, which is what a learning tool needs.",
    "Hand-rolled: no surprises when the library releases a new major version.",
  ],
  cons: [
    "The SDK hides things: a stopped answer reports no token usage, retries happen silently, and rate-limit headers only arrive after the stream ends.",
    "The SDK changes: version 7 renamed several functions and fields that most online examples still use.",
    "Hand-rolled: about 500 more lines to write, test and keep working as providers change.",
  ],
  surprises: [
    "One lane is much faster in one race and slower in the next. Free-tier latency varies by seconds; compare several races, not one.",
    "The SDK's stream carries an odd thoughtSignature blob from Gemini. Library internals leak through to the browser.",
    'Race answers show up in the ledger with source "sdk" or "chat". They\'re real runs.',
  ],
  lessons: ["libraries-vs-hand-rolled", "streaming"],
  next: { href: "/learn/full-pipeline", label: "Lesson 13: one question traced end to end" },
};
