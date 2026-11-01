import { Term } from "@/components/term";

import type { Guide } from "./types";

export const documentsGuide: Guide = {
  match: (p) => p === "/documents",
  title: "Documents",
  summary: (
    <p>
      The library chat answers from. Upload a file and watch it go through <Term id="ingestion" />:
      its text is pulled out, cut into <Term id="chunk">chunks</Term>, each chunk turned into an{" "}
      <Term id="embedding" />, and everything stored in the database.
    </p>
  ),
  why: (
    <>
      <p>
        Search can&apos;t read a PDF at question time; it&apos;s far too slow. All the expensive
        work is done once, here, so each question only has to compare against vectors that are
        already stored.
      </p>
      <p>
        <strong>Without this step</strong> there is nothing to search: chat with Use documents on
        says &quot;No documents to search yet.&quot; And what happens here (how cleanly the text
        comes out, where it&apos;s cut) limits every answer later.
      </p>
    </>
  ),
  inputs: [
    {
      name: "Choose files",
      what: "Pick one or more .md, .txt or .pdf files (up to 50 PDF pages or 4 MB each). They're processed one at a time.",
    },
    {
      name: "Upload password",
      what: "Only needed on the deployed site, to stop strangers using up the free quota. Leave it blank when running locally.",
    },
    {
      name: "The bin icon on a row",
      what: "Deletes the document and all its chunks. Chat stops finding it straight away.",
    },
  ],
  steps: [
    {
      do: "Look at the Library table before uploading anything.",
      see: "Seven documents, from pgvector-notes.pdf (1 page, 218 tokens) to build-plan.md (5,980 tokens), and the Library size bar at about 22,000 of 150,000 tokens.",
    },
    {
      do: "Make a small .md or .txt file with a few paragraphs on any topic and upload it.",
      see: "A progress card with one line per step: extracted N chars ≈ N tokens, then N chunks with average size, then embeddings (from cache / from Gemini), then stored.",
    },
    {
      do: "Upload exactly the same file again.",
      see: '"Replaced the earlier copy", and the embeddings line says every chunk came from cache, with 0 tokens embedded. Same text, same vectors, no new cost.',
    },
    {
      do: "Go to Chat and ask something only your new file answers.",
      see: "Your file appears among the sources, and the answer cites it.",
    },
    {
      do: "Come back and delete your test file with the bin icon.",
      see: "It disappears from the table, and the same question in chat no longer finds it.",
    },
  ],
  reading: [
    {
      name: "Tokens",
      what: (
        <>
          The document&apos;s length in <Term id="token">tokens</Term>, the unit models count in.
          Roughly ¾ of a word each.
        </>
      ),
    },
    {
      name: "Chunks",
      what: (
        <>
          How many pieces chat searches for this document: its <Term id="active-set">active</Term>{" "}
          chunk set. Uploads are cut into about 400-token chunks with 40 tokens of{" "}
          <Term id="overlap" />.
        </>
      ),
    },
    {
      name: "Library size",
      what: "Total tokens across all documents against a self-imposed 150,000 cap, so a full re-embed stays inside one day of Gemini's free quota.",
    },
    {
      name: "The progress lines",
      what: (
        <>
          Each step&apos;s time since the upload started. &quot;From cache&quot; chunks were
          embedded before (the <Term id="cache" /> is keyed by the chunk&apos;s text); &quot;waiting
          … for the per-minute token budget&quot; means it&apos;s pausing to stay under a{" "}
          <Term id="rate-limit" />.
        </>
      ),
    },
  ],
  pros: [
    "All the slow work happens once per file, not once per question.",
    "Re-uploading unchanged text is free thanks to the embedding cache.",
    "Markdown and plain text come out clean, with their headings, so they chunk well.",
  ],
  cons: [
    "PDFs lose structure: columns can come out in the wrong order and tables become runs of words.",
    "Scanned PDFs (pictures of pages) have no text to extract at all; they'd need OCR.",
    "One chunking setting is used for every upload. The chunking lab is where you try others.",
  ],
  surprises: [
    "A PDF's token count looks small for its size. File size is mostly fonts and layout, not words.",
    "Uploading a big file pauses part-way. That's the app waiting for Gemini's per-minute allowance, on purpose.",
    "The chunk count changes after you save a set in the chunking lab and make it active. Chat always searches the active set.",
  ],
  lessons: ["chunking", "embeddings", "caching-and-cost"],
  next: { href: "/lab/chunking", label: "Chunking lab: how documents are cut" },
};
