import { Term } from "@/components/term";

import type { Guide } from "./types";

export const evalsGuide: Guide = {
  match: (p) => p === "/evals",
  title: "Evals",
  summary: (
    <p>
      An exam for the whole system. 25 questions whose answers are known run through one setup, and
      each gets scored. Change one setting, run the exam again, and compare the two score cards.
    </p>
  ),
  why: (
    <>
      <p>
        Trying a few questions in chat and thinking &quot;that seems better&quot; is how most RAG
        tuning goes wrong: a change that fixes one question quietly breaks two others you
        didn&apos;t try.
      </p>
      <p>
        <strong>Without evals</strong> you can&apos;t say whether hybrid search, reranking or a new
        chunk size helped. With them you get a number before and after, and a list of exactly which
        questions got better or worse.
      </p>
    </>
  ),
  inputs: [
    {
      name: "Mode",
      what: (
        <>
          <em>Retrieval only</em>: just checks whether the right chunk was found. No LLM, about a
          minute. <em>Full</em>: also writes every answer and has a stronger model grade them (
          <Term id="llm-judge" />
          ). Slower, and uses the judge&apos;s 20-a-day free quota.
        </>
      ),
    },
    {
      name: "Chunk sets, Retrieval, Top-k, Embedding, Rerank",
      what: "The setup being tested: which chunks to search, how to search them, how many results count, which embedding model, and whether to rerank.",
    },
    {
      name: "Label",
      what: 'A name for the run, like "baseline" or "hybrid", so you can find it in the table.',
    },
    {
      name: "Tick boxes in Runs",
      what: "Tick two runs to open Compare.",
    },
    {
      name: "Eval set → Add a question",
      what: "Add your own question, its expected answer, and a passage copied from the document that contains the answer.",
    },
  ],
  steps: [
    {
      do: 'Leave Mode on Retrieval only and Retrieval on vector, label it "baseline", and press Run 25 questions.',
      see: "A progress count while it works one question at a time, then a new row: hit rate 88%, MRR 0.83 (on recursive chunks, top 5).",
    },
    {
      do: "Run it again with Retrieval set to hybrid, then once more with Rerank on.",
      see: "Hybrid: 92%, MRR 0.88. Hybrid + rerank: 100%, MRR 0.98.",
    },
    {
      do: "Tick the baseline and the rerank run, and read Compare.",
      see: "Which questions were fixed (missed before, found now), which moved up the ranking, and whether any broke.",
    },
    {
      do: "Click the rerank run, then one question.",
      see: "The chunks it found, each with a bar for how much of the expected passage it contains, and a link to open that question in the retrieval arena.",
    },
    {
      do: 'Click the "hybrid + rerank (full)" run.',
      see: "The judge's 1–5 scores for faithfulness and relevance, and a line saying 4 judge calls failed. The daily quota ran out; Complete on that run judges the rest once the quota resets.",
    },
  ],
  reading: [
    {
      name: "Hit rate",
      what: (
        <>
          Out of 25 questions, how many found the answer anywhere in the top-k (
          <Term id="hit-rate" />
          ). 88% = 22 of 25.
        </>
      ),
    },
    {
      name: "MRR",
      what: (
        <>
          How near the top the answer was (<Term id="mrr" />
          ): 1 if always first, 0.5 if always second. 0.98 means almost always first.
        </>
      ),
    },
    {
      name: "Faithful, Relevant",
      what: (
        <>
          Full runs only. The judge&apos;s average 1–5 for <Term id="faithfulness" /> (no made-up
          claims) and <Term id="relevance" /> (answers the question). &quot;5 of 25 judged&quot;
          means the rest weren&apos;t graded.
        </>
      ),
    },
    {
      name: "#1, #2 or miss on a question",
      what: "Where the first chunk containing the answer ranked.",
    },
    {
      name: "Coverage bar",
      what: "How much of the expected passage a retrieved chunk contains. Filled in colour means it counts as a hit.",
    },
    {
      name: "Tokens, Paid-tier cost",
      what: "What a full run used: answering and judging 25 questions cost about $0.06 at paid prices.",
    },
  ],
  pros: [
    'Turns "seems better" into a number you can compare.',
    "Retrieval scores need no LLM, so they're fast, free and repeatable.",
    "Per-question results show exactly what a change fixed and what it broke.",
  ],
  cons: [
    "25 questions is small: one question is 4% of the hit rate.",
    "A judge model is lenient. It gave almost everything 5 out of 5 here, so its scores separate setups poorly.",
    "The questions were written with these documents in mind, so the scores flatter the system compared with real users' questions.",
    "Full runs eat the judge model's 20-a-day free quota quickly.",
  ],
  surprises: [
    "\"4 judge calls failed … HTTP 429\": the judge's daily free quota ran out. It's a limit, not a bug; press Complete the next day.",
    "Keyword search has a higher hit rate than vector but a lower MRR: it finds more answers but ranks them worse, because common words match everywhere.",
    "Hit rate only checks the right passage was found, not that the answer used it. That's what faithfulness is for.",
  ],
  lessons: ["evaluating-rag"],
  next: { href: "/lab/sdk", label: "Library comparison: the same chat on an SDK" },
};
