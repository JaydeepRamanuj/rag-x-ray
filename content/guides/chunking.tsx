import Link from "next/link";

import { Term } from "@/components/term";

import type { Guide } from "./types";

export const chunkingGuide: Guide = {
  match: (p) => p === "/lab/chunking",
  title: "Chunking lab",
  summary: (
    <p>
      One document cut into <Term id="chunk">chunks</Term> four different ways, side by side, so you
      can see where each method puts the cuts. Nothing is saved until you press <em>Save as set</em>
      .
    </p>
  ),
  why: (
    <>
      <p>
        Search can only return whole chunks. If the sentence that answers a question is cut in half,
        neither half may look like the answer, and it&apos;s never found. Where you cut quietly
        decides what chat can and can&apos;t answer.
      </p>
      <p>
        <strong>Without this lab</strong> you&apos;d pick a chunk size by guesswork and never see
        the damage: the sentences cut mid-way, the headings separated from their paragraphs.
      </p>
    </>
  ),
  inputs: [
    { name: "Document", what: "Which uploaded file to cut up." },
    {
      name: "Chunk size (100–1,000 tokens)",
      what: "The longest a chunk may be. Small chunks are precise but lose context; big ones keep context but blur several topics into one vector.",
    },
    {
      name: "Overlap (0–30%)",
      what: (
        <>
          How much of each chunk&apos;s end is repeated at the start of the next (
          <Term id="overlap" />
          ). Protects sentences near a cut, at the cost of storing some text twice.
        </>
      ),
    },
    {
      name: "Semantic threshold (0–0.9)",
      what: "Only for the semantic column. How different two neighbouring sentences must be before it cuts between them. Higher means more cuts and smaller chunks.",
    },
    {
      name: "Save as set",
      what: (
        <>
          Stores that column&apos;s chunks as a <Term id="chunk-set" /> and embeds them with both
          models. In the table below, <em>Make active</em> switches chat to it, and an{" "}
          <em>Embed …</em> button appears if a set is missing one model&apos;s vectors.
        </>
      ),
    },
  ],
  steps: [
    {
      do: (
        <>
          Open the lab at{" "}
          <Link href="/lab/chunking?size=200&overlap=20">200 tokens, 20% overlap</Link> and pick{" "}
          <strong>build-plan.md</strong> in Document.
        </>
      ),
      see: "Four columns: Fixed, Recursive, Sentence, Semantic, each with its own numbers on top and the document below, tinted chunk by chunk.",
    },
    {
      do: "Compare the Sentences cut number across the four columns.",
      see: "Fixed cuts 67 sentences across 38 chunks. Recursive, Sentence and Semantic cut none: they only cut at paragraph, line or sentence boundaries.",
    },
    {
      do: "Scroll the Fixed column and look for red ✂ marks.",
      see: 'Cuts in the middle of words and sentences. That\'s what "cut every N tokens wherever it lands" does. Hover a chunk to see its number and size.',
    },
    {
      do: "Set the size to 400 and overlap to 10%, the settings chat uses.",
      see: "Fixed, Recursive and Sentence all give 17 chunks; Semantic gives 25, with the widest spread of sizes, because it follows the document's sections.",
    },
    {
      do: "Drag the semantic threshold from 0.40 up to 0.50.",
      see: "Semantic jumps to 46 chunks, many of them a single heading. Too sensitive, and it cuts at every change of topic, however small.",
    },
  ],
  reading: [
    {
      name: "Tinted text",
      what: "Each chunk has its own tint. Darker violet bands are overlap: text that belongs to two chunks. Small grey numbers mark where each chunk starts.",
    },
    { name: "Red ✂", what: "A cut through the middle of a word." },
    { name: "Chunks", what: "How many pieces this method made." },
    {
      name: "Avg ± spread, Min–max",
      what: "Typical chunk size in tokens, and how much sizes vary. Even sizes make search behave consistently; uneven ones mean some chunks hold far more than others.",
    },
    {
      name: "Sentences cut",
      what: "Sentences split across two chunks, out of all sentences. Red when above zero. Lower is better.",
    },
    {
      name: "Stored / source",
      what: "How much text is stored compared with the original. 1.25× means a quarter extra, from overlap. More storage, more embedding cost.",
    },
    {
      name: "Saved chunk sets table",
      what: (
        <>
          Every saved way of cutting each document. The <Term id="active-set">active</Term> one is
          what chat searches; the others can still be searched in the retrieval arena and evals.
        </>
      ),
    },
  ],
  pros: [
    "Fixed: simple and predictable sizes.",
    "Recursive: respects paragraphs and lines, so ideas stay together. A good default, and what uploads use.",
    "Sentence: never cuts a sentence, with the most even sizes.",
    "Semantic: cuts where the topic changes, so each chunk is about one thing.",
  ],
  cons: [
    "Fixed: cuts through words and sentences; a definition can end up split across chunks.",
    "Recursive and sentence: a long section still gets split somewhere arbitrary.",
    "Semantic: has to embed every sentence first (slower), and its sizes vary wildly, from tiny headings to long blocks.",
    "Overlap: more storage and embedding tokens for the same text.",
  ],
  surprises: [
    "Below a threshold of about 0.30, semantic gives the same chunks as the others: the size limit does all the cutting.",
    "Previews are instant because nothing is embedded until you save, except semantic, which needs sentence embeddings (from the local model) to decide its cuts.",
    "Saving a set doesn't change chat. Only Make active does.",
  ],
  lessons: ["chunking"],
  next: { href: "/lab/embeddings", label: "Embedding explorer: what a chunk becomes" },
};
