import Link from "next/link";

import { Term } from "@/components/term";

import type { Guide } from "./types";

export const embeddingsGuide: Guide = {
  match: (p) => p === "/lab/embeddings",
  title: "Embedding explorer",
  summary: (
    <p>
      A map of meaning. Every chunk chat can search is a dot; chunks about similar things sit close
      together. Type a question and it appears as a star, joined to the five chunks search would
      actually return. Below the map, a playground scores how alike two sentences are.
    </p>
  ),
  why: (
    <>
      <p>
        <Term id="vector-search">Vector search</Term> works by turning text into 768 numbers (an{" "}
        <Term id="embedding" />) and finding the closest ones. Nobody can picture 768 numbers, so
        the idea stays abstract. This page squashes them to 2 so you can see the neighbourhoods that
        search is working with.
      </p>
      <p>
        <strong>Without it</strong> you&apos;d have to take &quot;similar meaning, similar
        numbers&quot; on trust, and you&apos;d miss its blind spots: the playground shows &quot;not
        safe&quot; scoring almost the same as &quot;safe&quot;.
      </p>
    </>
  ),
  inputs: [
    {
      name: "Place query",
      what: "Type a question and press Enter. It's embedded the same way chat embeds your questions, and drawn as a star.",
    },
    {
      name: "Embedding model",
      what: (
        <>
          Gemini (768 numbers, via Google) or all-MiniLM (384 numbers, runs on this computer). Two
          different <Term id="embedding-model">models</Term> give two different maps of the same
          text.
        </>
      ),
    },
    {
      name: "Dimensions",
      what: (
        <>
          768 uses every number Gemini stored. 256 keeps only the first 256 (
          <Term id="matryoshka">Matryoshka</Term>
          ), to see how much a three-times-smaller vector loses.
        </>
      ),
    },
    {
      name: "Projection",
      what: (
        <>
          How 768 numbers become 2. <Term id="umap" /> keeps close neighbours close.{" "}
          <Term id="pca" /> keeps the two biggest overall directions. Both throw a lot away.
        </>
      ),
    },
    {
      name: "Legend",
      what: "Click a document name to highlight only its chunks.",
    },
    {
      name: "Playground presets and sentences",
      what: "Pick a preset (Synonyms, Negation, Word order, Spanish, Hindi, Same word, Unrelated) or type two sentences, then Compare.",
    },
  ],
  steps: [
    {
      do: "Look at the map before typing anything.",
      see: "64 dots in seven colours, one colour per document. Dots of one colour mostly cluster: a document's chunks are about related things.",
    },
    {
      do: (
        <>
          Place the query <em>What does a cross-encoder reranker add?</em> (or{" "}
          <Link href="/lab/embeddings?q=What%20does%20a%20cross-encoder%20reranker%20add%3F">
            open it pre-filled
          </Link>
          ).
        </>
      ),
      see: 'A star, dashed lines to the 5 nearest chunks, and the list of those chunks with their similarity on the right. The badge reads about "3 of 5": only 3 of the true 5 nearest are also the closest dots on the map.',
    },
    {
      do: "Switch Projection to PCA.",
      see: "A completely different layout, and the badge drops to about 2 of 5. The list on the right doesn't change, because search never uses the map.",
    },
    {
      do: "Switch Dimensions to 256, then the model to all-MiniLM.",
      see: "At 256 the nearest-chunks list barely changes (across all chunks, 89% of neighbours stay the same). The local model finds a different set of neighbours altogether.",
    },
    {
      do: "In the playground, press Unrelated, then Negation.",
      see: 'Unrelated: Gemini still gives about 0.71, MiniLM about 0.01. Negation ("safe for children" vs "not safe for children"): MiniLM scores 0.936, higher than real synonyms. Embeddings barely notice "not".',
    },
  ],
  reading: [
    {
      name: "Dots and colours",
      what: "One dot per chunk, coloured by document. Hover a dot for its document, chunk number and opening text.",
    },
    {
      name: "The star and dashed lines",
      what: "Your question, and lines to the 5 chunks with the highest similarity in all 768 numbers. That's exactly what chat's vector search would return.",
    },
    {
      name: "Nearest 5 chunks",
      what: (
        <>
          The true neighbours with their <Term id="cosine">cosine similarity</Term>. A chunk tagged
          &quot;not in the 2D top 5&quot; is close in reality but looks far on the map.
        </>
      ),
    },
    {
      name: "N of 5 badge",
      what: "How honest the map is near your question: how many of the true 5 are also the 5 closest dots. 5 of 5 is rare.",
    },
    {
      name: "Playground scores",
      what: 'Cosine similarity of the two sentences, for each model. Compare within a column only: each model has its own floor for "unrelated".',
    },
    {
      name: "Table view",
      what: "The same points as numbers, for anyone who can't see the colours.",
    },
  ],
  pros: [
    "Embeddings match meaning, not spelling: synonyms score 0.97 with Gemini.",
    "Gemini matches across languages: an English sentence and its Spanish translation score 0.96.",
    "Vectors can be shortened (768 to 256) with little loss, saving storage and search time.",
  ],
  cons: [
    'They barely see negation or word order: "the dog bit the man" and "the man bit the dog" score about 0.96.',
    "Scores don't mean the same thing across models, so a fixed cut-off like \"above 0.8\" doesn't transfer.",
    "The small local model can't match across languages at all (Spanish: 0.16).",
    "Any 2D map distorts: clusters' sizes and the gaps between them mean little.",
  ],
  surprises: [
    "The map shifts a little each time you place a query. UMAP is re-run with the question included.",
    "Two chunks that look far apart on the map can be nearest neighbours in reality. Trust the list, not the picture.",
    '"Bank" (river) and "bank" (money) score fairly high with Gemini (0.72). Sharing a word pulls vectors together even when the meaning differs.',
  ],
  lessons: ["embeddings", "vector-databases"],
  next: { href: "/lab/retrieval", label: "Retrieval arena: four ways to search" },
};
