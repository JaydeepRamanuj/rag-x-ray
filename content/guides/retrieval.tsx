import Link from "next/link";

import { Term } from "@/components/term";

import type { Guide } from "./types";

export const retrievalGuide: Guide = {
  match: (p) => p === "/lab/retrieval",
  title: "Retrieval arena",
  summary: (
    <p>
      One question, searched four ways at once, in four columns: by meaning (
      <Term id="vector-search">vector</Term>), by words (<Term id="keyword-search">keyword</Term>
      ), both merged (<Term id="hybrid">hybrid</Term>), and the merged list re-sorted by a smarter
      model (<Term id="rerank" />
      ). No answer is written; this page is only about finding the right chunks.
    </p>
  ),
  why: (
    <>
      <p>
        <Term id="retrieval">Retrieval</Term> is where most RAG answers go wrong: if the right chunk
        isn&apos;t found, the model can&apos;t use it. Each search method fails in its own way, and
        you can&apos;t see that from a chat answer.
      </p>
      <p>
        <strong>Without the arena</strong> you&apos;d only see the final five sources, never the
        chunk that came 6th, or that keyword search found and vector search missed. Here you see
        every method&apos;s ranking and how far each one moved each chunk.
      </p>
    </>
  ),
  inputs: [
    {
      name: "Search box",
      what: "A question or a few words. Press Search to run all four methods.",
    },
    {
      name: "Top-k (3–20)",
      what: (
        <>
          How many results each column shows (<Term id="top-k" />
          ). Chat uses 5 by default.
        </>
      ),
    },
    {
      name: "Embedding model",
      what: "Which model's vectors the vector column searches. Keyword search doesn't use vectors, so it's the same either way.",
    },
    {
      name: "Chunk sets",
      what: (
        <>
          What to search: the <Term id="active-set">active sets</Term> (what chat searches), the
          newest set of one strategy, or one specific set. This is how you compare chunking
          strategies on real questions.
        </>
      ),
    },
    {
      name: "Rerank with Cohere",
      what: "Fills the fourth column. Each new query uses one of 1,000 free calls a month; repeated queries come from the cache and are free. On the deployed site it needs the password.",
    },
  ],
  steps: [
    {
      do: (
        <>
          Open the arena with{" "}
          <Link href="/lab/retrieval?q=umap-js&k=3&rerank=0">umap-js, top 3, rerank off</Link> and
          press Search.
        </>
      ),
      see: "Vector returns build-plan.md chunks 3, 13 and 6: none of them mention umap-js. Keyword returns 8, 11 and 16: all three do. Hybrid keeps keyword's three.",
    },
    {
      do: "Hover a chunk in the Hybrid column.",
      see: "The same chunk lights up in every column it appears in, so you can follow it between methods.",
    },
    {
      do: (
        <>
          Now try a real question with rerank on:{" "}
          <Link href="/lab/retrieval?q=Which%20library%20draws%20the%202D%20projection%2C%20and%20where%20does%20it%20run%3F&k=5">
            Which library draws the 2D projection, and where does it run?
          </Link>
        </>
      ),
      see: "The answer is in build-plan.md chunk 8. Vector has it 2nd, only 0.003 behind 1st. Keyword misses it. Hybrid has it 3rd. Rerank puts it 1st, with a clear gap (0.644 against 0.219), and its badge says ↑2.",
    },
    {
      do: "Press Search again without changing anything.",
      see: "The rerank column says it was cached: no time, no quota used.",
    },
  ],
  reading: [
    {
      name: "#1, #2 …",
      what: "Each column's ranking, best first. The chunk text is below each header.",
    },
    {
      name: "Vector score",
      what: (
        <>
          <Term id="cosine">Cosine similarity</Term> to the question. Gemini&apos;s scores bunch
          together (often within 0.03), so small gaps between them mean little.
        </>
      ),
    },
    {
      name: "Keyword score",
      what: (
        <>
          Postgres full-text rank (a <Term id="bm25" /> stand-in). The note shows how your query was
          turned into search terms: common words are dropped, the rest reduced to stems.
        </>
      ),
    },
    {
      name: "Hybrid score",
      what: (
        <>
          The <Term id="rrf" /> sum, tiny numbers like 0.032. V and K show the chunk&apos;s rank in
          the vector and keyword lists.
        </>
      ),
    },
    {
      name: "Rerank score",
      what: (
        <>
          The <Term id="cross-encoder">cross-encoder</Term>&apos;s relevance, 0 to 1. Unlike cosine,
          the gaps here are big and meaningful. The note shows tokens billed and calls used this
          month.
        </>
      ),
    },
    {
      name: "↑2 from 4, ↓1, new vs vector",
      what: 'How far this method moved the chunk compared with the previous column. "New" means the earlier column didn\'t have it at all.',
    },
  ],
  pros: [
    "Vector: finds matches by meaning, even with no shared words.",
    "Keyword: finds exact names, codes and rare words that embeddings blur.",
    "Hybrid: gets both for the price of one extra cheap database query.",
    "Rerank: the most accurate order, because it reads the question and the chunk together.",
  ],
  cons: [
    "Vector: weak on names and rare terms (it missed every umap-js chunk).",
    'Keyword: blind to synonyms, and common words like "model" match everywhere.',
    "Hybrid: merging can push a good vector result down when keyword finds lookalikes.",
    "Rerank: about a second slower, costs per call, and only re-sorts what the first search found. It can't rescue a chunk that wasn't in the top 20.",
  ],
  surprises: [
    'Keyword returns nothing for a question made only of common words. Postgres drops words like "what" and "the".',
    "Vector scores all sit between 0.6 and 0.8 even for poor matches. That's Gemini's scale; only the order matters.",
    "Rerank promotes a chunk from outside hybrid's visible top-k. It reranks the top 20, not just the ones shown.",
  ],
  lessons: ["vector-databases", "hybrid-retrieval", "reranking"],
  next: {
    href: "/runs/0f59bf82-0072-4b8a-82e3-446c8f1d02aa/prompt",
    label: "Prompt inspector: what the model is sent",
  },
};
