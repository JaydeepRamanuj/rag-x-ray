import { Term } from "@/components/term";

import type { Guide } from "./types";

export const chatGuide: Guide = {
  match: (p) => p === "/chat",
  title: "Chat",
  summary: (
    <>
      <p>
        Ask a question and get an answer written from your own documents, with numbered{" "}
        <Term id="citation">citations</Term> you can check. This is the whole <Term id="rag" />{" "}
        pipeline in one box; every other page opens up one of its steps.
      </p>
    </>
  ),
  why: (
    <>
      <p>
        An <Term id="llm" /> on its own only knows what it read during training. It has never seen
        your files, and when it doesn&apos;t know something it often makes up a confident answer (a{" "}
        <Term id="hallucination" />
        ).
      </p>
      <p>
        Chat fixes that by searching your documents first and pasting the best passages into the
        question. <strong>Without it</strong> you&apos;d get answers you can&apos;t trace to any
        source. Switch <em>Use documents</em> off to see exactly that difference.
      </p>
    </>
  ),
  inputs: [
    {
      name: "The question box",
      what: "Type a question in normal words. Enter sends it; Shift+Enter starts a new line. Earlier turns are sent along, so follow-ups work.",
    },
    {
      name: "Model",
      what: (
        <>
          Which <Term id="llm" /> writes the answer. Gemini 3.5 Flash-Lite is the fast default.
          Gemini 3.8 Flash is stronger but has only 20 free requests a day. The two GPT-OSS models
          run on Groq, a different <Term id="provider" />.
        </>
      ),
    },
    {
      name: "Use documents",
      what: "On: search your documents and answer from them. Off: send the question straight to the model with no sources, like a normal chatbot.",
    },
    {
      name: "top 3 / 5 / 8 / 10",
      what: (
        <>
          <Term id="top-k">How many chunks</Term> to find and put in the prompt. More gives the
          model more chances to see the answer, but makes the prompt longer, slower and pricier.
        </>
      ),
    },
    {
      name: "vector / keyword / hybrid",
      what: (
        <>
          How chunks are found. <Term id="vector-search">Vector</Term> matches by meaning,{" "}
          <Term id="keyword-search">keyword</Term> by exact words, <Term id="hybrid">hybrid</Term>{" "}
          does both and merges them.
        </>
      ),
    },
    {
      name: "Rerank",
      what: (
        <>
          Adds a second, more careful sorting pass (<Term id="rerank" />) with Cohere. Better order,
          about a second slower, and it uses a monthly free allowance of 1,000 calls.
        </>
      ),
    },
  ],
  steps: [
    {
      do: (
        <>
          Leave the settings as they are and ask:{" "}
          <em>What does hnsw.ef_search control in pgvector, and what is its default?</em>
        </>
      ),
      see: 'A short answer with small [1] markers, and five source rows under it. One source (pgvector-notes.pdf) is cited; the other four say "not cited".',
    },
    {
      do: "Click the first source row to open it.",
      see: "The chunk's text. The sentence the answer used is in there; this is how you check an answer.",
    },
    {
      do: "Read the grey line of numbers under the sources.",
      see: "Something like: embed 691 ms, vector 1.46 s, TTFT 3.40 s, total 3.48 s, in 1,845, out 35, cost if paid $0.000641. The prompt was 1,845 tokens; the answer only 35.",
    },
    {
      do: "Turn Use documents off and ask the same question again.",
      see: "An answer from the model's memory: no sources and no citations. It may still be right, but nothing lets you check it, and the input drops to a few dozen tokens.",
    },
    {
      do: "Turn Use documents back on, then click Inspect under the first answer.",
      see: "The prompt inspector: the exact text the model received, with the sources taking about 95% of it.",
    },
  ],
  reading: [
    {
      name: "[1], [2] in the answer",
      what: "Citations. Each number points at the source row with the same number. Click one to open that source.",
    },
    {
      name: "Source rows",
      what: (
        <>
          The chunks that were found, best first: file name, chunk number, and a bar with the{" "}
          <Term id="cosine">similarity score</Term> (or the rerank score). &quot;Not cited&quot;
          means the model didn&apos;t use that chunk.
        </>
      ),
    },
    {
      name: "embed",
      what: (
        <>
          Time to turn your question into an <Term id="embedding" />. &quot;(cached)&quot; means it
          came from the <Term id="cache" /> because the same question was asked before.
        </>
      ),
    },
    {
      name: "vector / keyword / hybrid / search, rerank",
      what: 'Time spent searching the database, then reranking (or "cached").',
    },
    {
      name: "TTFT and total",
      what: (
        <>
          <Term id="ttft" />: how long until the first word appeared. Total: until the last.
        </>
      ),
    },
    {
      name: "in, out",
      what: (
        <>
          <Term id="input-output-tokens">Input and output tokens</Term>: what was sent and what came
          back. Thinking models add &quot;(N thinking)&quot;.
        </>
      ),
    },
    {
      name: "cost if paid",
      what: (
        <>
          What this one answer would cost at paid prices (<Term id="cost-if-paid" />
          ). Your real cost is $0.
        </>
      ),
    },
    {
      name: "Inspect, Stream",
      what: "Open this answer in the prompt inspector (what was sent) or the streaming debugger (how it arrived).",
    },
  ],
  pros: [
    "Answers come from your documents, and every claim can be checked against a source.",
    "Updating knowledge is just uploading a new file; no model training.",
    'Saying "the sources don\'t say" is allowed, which cuts down made-up answers.',
  ],
  cons: [
    "If search misses the right chunk, the answer is wrong or empty no matter how good the model is.",
    "Every question pays for the sources in the prompt: here about 1,700 extra tokens each time.",
    "Search adds a second or two before the model starts writing.",
    'Follow-up questions like "what about its default?" are searched as-is, so they can find the wrong chunks.',
  ],
  surprises: [
    "The answer says the sources don't contain something you know is true. That's the rules working: it may only use the sources, and the right chunk wasn't found. Try hybrid or Rerank.",
    "Asking the same question twice gives different wording. Models pick words with some randomness, even at a low temperature.",
    "TTFT jumps between 1 and 5 seconds for the same question. That's the free tier's queue at Google, not this app.",
    'A source with a high score is "not cited". Similar-sounding isn\'t the same as containing the answer.',
  ],
  lessons: ["llm-api-call", "full-pipeline"],
  next: { href: "/documents", label: "Documents: where the sources come from" },
};
