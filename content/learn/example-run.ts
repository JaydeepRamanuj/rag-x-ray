/**
 * One real run, for the pipeline walkthrough: Lesson 13's question, cold cache
 * (run 0f59bf82-0072-4b8a-82e3-446c8f1d02aa, 1 Nov 2026). Scores, answer and
 * token counts were read once from Neon (runs, run_chunks) on 4 Nov 2026;
 * timings are the cold-run column of Lesson 13's table. Only the reranked
 * top 5 are saved for a run, so the 20 search candidates have no scores here.
 */
export const exampleRun = {
  id: "0f59bf82-0072-4b8a-82e3-446c8f1d02aa",
  question: "What does the HNSW index do, and why did Postgres ignore it here?",
  questionTokens: 18,
  inputTokens: 1_910,
  outputTokens: 105,
  ms: { embed: 869, search: 557, rerank: 975, firstToken: 766, writing: 285 },
  // Reranked top 5, all sent to the model. Excerpts are each chunk's opening.
  sources: [
    {
      title: "pgvector-notes.pdf",
      score: 0.662,
      excerpt:
        "HNSW (Hierarchical Navigable Small World) is an approximate nearest neighbour index. It builds a multi-layer graph…",
    },
    {
      title: "retrieval-augmented-generation.md",
      score: 0.604,
      excerpt:
        "Exact search compares the query with every stored vector. That is fine for thousands of chunks but too slow for many millions…",
    },
    {
      title: "build-plan.md",
      score: 0.321,
      excerpt: "| Streaming | Server-Sent Events from the route handler to the browser…",
    },
    {
      title: "build-plan.md",
      score: 0.276,
      excerpt: "CREATE EXTENSION IF NOT EXISTS vector; CREATE TABLE documents (…",
    },
    {
      title: "build-plan.md",
      score: 0.15,
      excerpt: "Lessons: 1. How an LLM API call works: messages, roles, parameters…",
    },
  ],
  answer:
    "The provided sources do not contain information explaining why Postgres ignored an HNSW index. \n\nHowever, regarding what the HNSW (Hierarchical Navigable Small World) index does: it is an approximate nearest neighbor index that builds a multi-layer graph where each vector links to its closest neighbors [1][2]. Searches start at the top, coarser layer and greedily move closer to the query while dropping down a layer each time, providing high recall and fast queries at the cost of using more memory [1][2].",
  // The indexing side follows the corpus file behind source [2], which is in
  // content/corpus/; the others were uploaded through the app.
  document: { title: "retrieval-augmented-generation.md", tokens: 3_467, chunks: 11 },
} as const;
