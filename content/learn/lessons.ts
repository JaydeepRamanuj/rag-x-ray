export type Lesson = {
  slug: string;
  number: number;
  title: string;
  summary: string;
  /** Lessons are written in the phase that builds the module they describe. */
  phase: number;
  /** True once content/learn/<slug>.mdx exists. */
  written: boolean;
};

export const lessons: Lesson[] = [
  {
    slug: "llm-api-call",
    number: 1,
    title: "How an LLM API call works",
    summary: "Messages, roles, parameters, the response body.",
    phase: 1,
    written: true,
  },
  {
    slug: "tokens",
    number: 2,
    title: "Tokens and tokenisers",
    summary: "Why counts differ, input vs output pricing, context windows.",
    phase: 1,
    written: true,
  },
  {
    slug: "streaming",
    number: 3,
    title: "Streaming",
    summary: "SSE format, ReadableStream, parsing partial events, cancellation.",
    phase: 1,
    written: true,
  },
  {
    slug: "embeddings",
    number: 4,
    title: "Embeddings",
    summary: "What a vector means, dimensions, task types, cosine similarity.",
    phase: 2,
    written: true,
  },
  {
    slug: "chunking",
    number: 5,
    title: "Chunking",
    summary: "Four strategies and their trade-offs.",
    phase: 2,
    written: true,
  },
  {
    slug: "vector-databases",
    number: 6,
    title: "Vector databases",
    summary: "pgvector, HNSW vs exact search, distance operators.",
    phase: 2,
    written: true,
  },
  {
    slug: "hybrid-retrieval",
    number: 7,
    title: "Keyword search and hybrid retrieval",
    summary: "Full-text search, the BM25 idea, RRF.",
    phase: 4,
    written: true,
  },
  {
    slug: "reranking",
    number: 8,
    title: "Reranking",
    summary: "Bi-encoders vs cross-encoders, cost vs quality.",
    phase: 4,
    written: true,
  },
  {
    slug: "prompt-construction",
    number: 9,
    title: "Prompt construction",
    summary: "Context budgeting, citations, lost in the middle, grounding.",
    phase: 3,
    written: true,
  },
  {
    slug: "evaluating-rag",
    number: 10,
    title: "Evaluating RAG",
    summary: "Hit rate, MRR, faithfulness, LLM-as-judge pitfalls.",
    phase: 5,
    written: false,
  },
  {
    slug: "caching-and-cost",
    number: 11,
    title: "Caching and cost control",
    summary: "Embedding cache, prompt caching, rate limits and backoff.",
    phase: 3,
    written: true,
  },
  {
    slug: "libraries-vs-hand-rolled",
    number: 12,
    title: "Libraries vs hand-rolled",
    summary: "What the Vercel AI SDK does for you.",
    phase: 6,
    written: false,
  },
  {
    slug: "full-pipeline",
    number: 13,
    title: "The full pipeline",
    summary: "One request traced end to end, with real timings.",
    phase: 6,
    written: false,
  },
  {
    slug: "process-log",
    number: 14,
    title: "Process log",
    summary: "Decisions made while building, what broke and why.",
    phase: 0,
    written: true,
  },
];
