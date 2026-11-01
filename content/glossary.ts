/**
 * Plain-words definitions for every term the app uses. `<Term id="…">` shows
 * `short` on hover; /learn/glossary lists everything, grouped.
 *
 * Written for someone meeting RAG for the first time: no term is defined
 * with another undefined term, and `example` ties it to something you can
 * see in this app.
 */
export type GlossaryEntry = {
  id: string;
  term: string;
  group: GlossaryGroup;
  /** One or two sentences, shown in the hover card. */
  short: string;
  /** A longer explanation for the glossary page. */
  long?: string;
  /** An everyday comparison or a place in the app where you can see it. */
  example?: string;
  see?: string[];
};

export const glossaryGroups = [
  "The basics",
  "Documents and chunks",
  "Embeddings",
  "Searching",
  "The prompt and the answer",
  "Speed and cost",
  "Measuring quality",
] as const;
export type GlossaryGroup = (typeof glossaryGroups)[number];

export const glossary: GlossaryEntry[] = [
  // The basics
  {
    id: "llm",
    term: "LLM",
    group: "The basics",
    short:
      "Large language model: a program trained on huge amounts of text that writes text by predicting the next word, over and over.",
    long: "Gemini and GPT-OSS are LLMs. They know a lot in general, but only what was in their training data, and they will happily write something plausible when they don't know the answer.",
    example: "The model menu under the chat box picks which LLM writes the answer.",
    see: ["token", "hallucination"],
  },
  {
    id: "rag",
    term: "RAG",
    group: "The basics",
    short:
      "Retrieval-augmented generation: first find the passages of your documents that match the question, then ask the LLM to answer using only those passages.",
    long: "An LLM has never read your files. RAG fixes that without retraining the model: search your documents, paste the best passages into the prompt, and tell the model to answer from them and cite them. Every page of this app shows one stage of that process.",
    example:
      "Like an open-book exam: the student (the LLM) is clever, but you hand them the right pages first.",
    see: ["retrieval", "prompt", "citation"],
  },
  {
    id: "retrieval",
    term: "Retrieval",
    group: "The basics",
    short:
      "The search step of RAG: finding the chunks of your documents most likely to contain the answer.",
    long: "Retrieval quality limits everything after it. If the right passage isn't found, the best model in the world can't answer from it.",
    see: ["vector-search", "keyword-search", "hybrid", "top-k"],
  },
  {
    id: "hallucination",
    term: "Hallucination",
    group: "The basics",
    short:
      "When an LLM states something false with confidence, usually because it doesn't know and makes up something plausible.",
    long: "RAG reduces hallucination by giving the model the facts and telling it to say so when the sources don't contain the answer. Citations make the rest easier to catch.",
    see: ["grounding", "faithfulness"],
  },
  {
    id: "provider",
    term: "Provider",
    group: "The basics",
    short:
      "The company whose servers run a model: here Google (Gemini, embeddings), Groq (GPT-OSS) and Cohere (reranking).",
    long: "Each provider has its own API shape, prices and free-tier limits. This app talks to them directly with plain HTTP requests.",
  },
  {
    id: "run",
    term: "Run",
    group: "The basics",
    short:
      "One question answered, saved with everything about it: the exact prompt, the sources, the tokens, the timings and the cost.",
    example:
      "Every chat answer is a run. Its Inspect and Stream links open the run's prompt inspector and streaming debugger.",
  },
  {
    id: "sdk",
    term: "SDK",
    group: "The basics",
    short:
      "Software development kit: a library that wraps a service's API so you write less code. The Vercel AI SDK wraps many LLM providers behind one interface.",
    example:
      "The library comparison page puts this app's hand-written code next to the SDK version.",
  },

  // Documents and chunks
  {
    id: "chunk",
    term: "Chunk",
    group: "Documents and chunks",
    short:
      "A piece of a document, usually a few hundred tokens long. Search finds chunks, not whole documents.",
    long: "Documents are cut into chunks because one vector for a whole book would blur every topic together, and because a prompt only has room for a few passages.",
    example:
      "Like index cards cut from a book: you hand the model the right cards, not the whole book.",
    see: ["chunking", "overlap"],
  },
  {
    id: "chunking",
    term: "Chunking",
    group: "Documents and chunks",
    short:
      "Deciding where to cut documents into chunks. Fixed (every N tokens), recursive (at paragraphs, then lines), sentence, or semantic (where the topic changes).",
    long: "Where you cut decides what can be found. A definition split across two chunks may never be retrieved whole.",
    example: "The chunking lab shows one document cut all four ways, side by side.",
    see: ["chunk", "overlap", "chunk-set"],
  },
  {
    id: "overlap",
    term: "Overlap",
    group: "Documents and chunks",
    short:
      "Repeating the end of one chunk at the start of the next, so a sentence near a cut still appears whole in one of them.",
    long: "It costs storage and embedding tokens (the overlapping text is stored twice), in exchange for fewer ideas cut in half.",
  },
  {
    id: "chunk-set",
    term: "Chunk set",
    group: "Documents and chunks",
    short:
      "One way of chunking one document (for example recursive, 400 tokens, 10% overlap). A document can have several; one is active.",
    long: "Keeping several sets lets the retrieval arena and evals compare chunking strategies on the same text.",
    see: ["active-set"],
  },
  {
    id: "active-set",
    term: "Active set",
    group: "Documents and chunks",
    short:
      "The chunk set chat searches for each document. You switch it with Make active in the chunking lab.",
  },
  {
    id: "ingestion",
    term: "Ingestion",
    group: "Documents and chunks",
    short:
      "Everything that happens once per uploaded file: extract the text, cut it into chunks, embed each chunk, store chunks and vectors.",
    example: "The Documents page shows each step's progress as a file is uploaded.",
  },

  // Embeddings
  {
    id: "embedding",
    term: "Embedding",
    group: "Embeddings",
    short:
      "A list of numbers (a vector) that captures what a piece of text means. Texts with similar meaning get similar numbers.",
    long: 'An embedding model reads text and outputs, say, 768 numbers. Nobody chooses what each number means; the model learned them. What matters is that "cancel my order" and "I want a refund" land close together even though they share no words.',
    example:
      "Like map coordinates for meaning: nearby points are about similar things. The embedding explorer draws that map.",
    see: ["vector", "dimensions", "cosine"],
  },
  {
    id: "vector",
    term: "Vector",
    group: "Embeddings",
    short: "An ordered list of numbers, like [0.12, -0.53, 0.08, …]. An embedding is a vector.",
  },
  {
    id: "dimensions",
    term: "Dimensions",
    group: "Embeddings",
    short:
      "How many numbers are in a vector. Gemini's embeddings here have 768, the local model's have 384.",
    long: "More dimensions can hold finer distinctions but cost more storage and slower search. Gemini's vectors can be cut to their first 256 numbers and still work well.",
    see: ["matryoshka"],
  },
  {
    id: "cosine",
    term: "Cosine similarity",
    group: "Embeddings",
    short:
      "A score for how alike two vectors are, from about 0 (unrelated) to 1 (same meaning). It measures the angle between them.",
    long: "Each model has its own scale. Gemini scores two unrelated sentences around 0.71; the local model scores them around 0.01. Compare scores only within one model.",
    example:
      "The number next to each source under a chat answer (like 0.774) is its cosine similarity to the question.",
  },
  {
    id: "embedding-model",
    term: "Embedding model",
    group: "Embeddings",
    short:
      "A model that turns text into a vector. This app has two: Gemini Embedding 001 (an API) and all-MiniLM-L6-v2 (runs on your machine).",
    long: "Different models put text in different places, so a question must be embedded with the same model as the chunks it is searched against.",
  },
  {
    id: "task-type",
    term: "Task type",
    group: "Embeddings",
    short:
      "A hint to Gemini's embedding model about how the text will be used: as a stored document, as a search query, or for comparing two sentences.",
  },
  {
    id: "matryoshka",
    term: "Matryoshka embeddings",
    group: "Embeddings",
    short:
      "Embeddings trained so the first numbers carry the most meaning. You can keep only the first 256 of 768 numbers and lose little.",
    example:
      "Named after Russian nesting dolls: a smaller complete vector sits inside the bigger one.",
  },
  {
    id: "projection",
    term: "Projection (2D map)",
    group: "Embeddings",
    short:
      "Squashing 768 numbers down to 2 so the vectors can be drawn as dots. Some information is always lost.",
    see: ["umap", "pca"],
  },
  {
    id: "umap",
    term: "UMAP",
    group: "Embeddings",
    short:
      "A way to draw high-dimensional points in 2D that keeps each point's close neighbours close. Distances between far-apart clusters mean little.",
  },
  {
    id: "pca",
    term: "PCA",
    group: "Embeddings",
    short:
      "A way to draw high-dimensional points in 2D by keeping the two directions the points vary most along. Straight-line maths, so it's stable but loses more.",
  },

  // Searching
  {
    id: "vector-search",
    term: "Vector search",
    group: "Searching",
    short:
      "Embed the question, then find the chunks whose vectors are closest to it. Finds matches by meaning, even with different words.",
    long: "Its weakness is exact names and rare words: a product code or library name means little to an embedding model.",
    see: ["embedding", "cosine", "hnsw"],
  },
  {
    id: "keyword-search",
    term: "Keyword search",
    group: "Searching",
    short:
      "Find chunks that contain the question's words, ranking rare words higher. Here it's Postgres full-text search.",
    long: 'Great for exact names and codes, blind to synonyms: "car" won\'t find "automobile".',
    see: ["bm25"],
  },
  {
    id: "bm25",
    term: "BM25",
    group: "Searching",
    short:
      "The classic formula for ranking keyword matches: a word counts more if it's rare across all documents and frequent in this one.",
    long: "This app uses Postgres's ts_rank_cd as a stand-in, which ranks on similar ideas without a separate search engine.",
  },
  {
    id: "hybrid",
    term: "Hybrid search",
    group: "Searching",
    short:
      "Run vector search and keyword search, then merge the two ranked lists. Gets meaning matches and exact-word matches.",
    see: ["rrf"],
  },
  {
    id: "rrf",
    term: "RRF",
    group: "Searching",
    short:
      "Reciprocal rank fusion: merges ranked lists by giving each chunk 1 ÷ (60 + its rank) from each list and adding them up.",
    long: "It only uses positions, not scores, so it doesn't matter that cosine similarity and keyword rank are on different scales. A chunk ranked well in both lists wins.",
  },
  {
    id: "top-k",
    term: "Top-k",
    group: "Searching",
    short:
      "How many chunks the search returns and the prompt includes. Top 5 means the five best matches.",
    long: "Higher k gives more chances to include the answer, but makes the prompt longer (more cost, slower) and adds more irrelevant text for the model to wade through.",
  },
  {
    id: "rerank",
    term: "Reranking",
    group: "Searching",
    short:
      "A second, slower, more accurate pass: a reranker model reads the question together with each candidate chunk and re-orders them.",
    long: "Here, the top 20 hybrid results go to Cohere's reranker and the best top-k come back. It catches answers that the first search ranked too low.",
    see: ["cross-encoder"],
  },
  {
    id: "cross-encoder",
    term: "Cross-encoder",
    group: "Searching",
    short:
      "A model that reads the question and a passage together and scores how well the passage answers it. Accurate but too slow to run on every chunk.",
    long: "Embedding search is a bi-encoder: question and chunk are turned into vectors separately, ahead of time. A cross-encoder sees both at once, so it can notice that one row of a table answers the question.",
  },
  {
    id: "hnsw",
    term: "HNSW index",
    group: "Searching",
    short:
      "A data structure that finds nearby vectors fast without comparing against every one, at the cost of sometimes missing the true nearest.",
    long: "With only 64 chunks here, Postgres compares against all of them anyway; an index starts paying off at thousands of rows.",
  },
  {
    id: "pgvector",
    term: "pgvector",
    group: "Searching",
    short:
      "A Postgres extension that stores vectors and searches them by distance, so vectors live in the same database as everything else.",
  },

  // The prompt and the answer
  {
    id: "prompt",
    term: "Prompt",
    group: "The prompt and the answer",
    short:
      "Everything sent to the LLM for one answer: the rules (system prompt), earlier turns, the numbered sources and the question.",
    example: "The prompt inspector shows the exact prompt for any run, part by part.",
  },
  {
    id: "system-prompt",
    term: "System prompt",
    group: "The prompt and the answer",
    short:
      'The standing instructions at the top of the prompt, such as "answer only from the sources, cite them, say so if they don\'t contain the answer".',
  },
  {
    id: "citation",
    term: "Citation",
    group: "The prompt and the answer",
    short:
      "A [1] or [2] in the answer pointing at the source it came from, so you can check the claim.",
    example: 'Under a chat answer, sources the answer didn\'t cite are marked "not cited".',
  },
  {
    id: "grounding",
    term: "Grounding",
    group: "The prompt and the answer",
    short:
      "Making the model base its answer on given text (the sources) instead of on what it remembers.",
  },
  {
    id: "temperature",
    term: "Temperature",
    group: "The prompt and the answer",
    short:
      "How random the model's word choices are. Low (like 0.2, used here) gives steady, factual answers; high gives more varied ones.",
  },
  {
    id: "context-window",
    term: "Context window",
    group: "The prompt and the answer",
    short:
      "The most tokens a model can read in one request, prompt and answer together. Sources have to fit inside it.",
  },
  {
    id: "streaming",
    term: "Streaming",
    group: "The prompt and the answer",
    short:
      "Sending the answer a few words at a time as the model writes it, instead of all at once at the end. Feels much faster.",
    see: ["sse", "ttft"],
  },
  {
    id: "sse",
    term: "SSE",
    group: "The prompt and the answer",
    short:
      "Server-sent events: a simple format for streaming over HTTP. Each message is a few lines like `event: token` and `data: {…}`, then a blank line.",
  },
  {
    id: "reasoning-tokens",
    term: "Thinking tokens",
    group: "The prompt and the answer",
    short:
      "Tokens some models write privately to reason before answering. You never see them, but they're billed as output.",
  },

  // Speed and cost
  {
    id: "token",
    term: "Token",
    group: "Speed and cost",
    short:
      "The unit models read and write: a word or a piece of one. About 4 characters of English, or ¾ of a word, on average.",
    long: "Providers bill per token and limit how many you can send. Different models split text into tokens differently, so the same text has different counts.",
    example:
      "A page of English is roughly 500 to 700 tokens. Lesson 2 counts the same text with two tokenisers.",
  },
  {
    id: "input-output-tokens",
    term: "Input and output tokens",
    group: "Speed and cost",
    short:
      "Input is what you send (the prompt), output is what the model writes. Output usually costs several times more per token.",
    long: "In RAG, input dominates: the sources make the prompt long and the answer is short. That's why top-k and chunk size drive the bill.",
  },
  {
    id: "ttft",
    term: "TTFT",
    group: "Speed and cost",
    short:
      'Time to first token: how long from pressing Send until the first word of the answer appears. What "fast" feels like.',
  },
  {
    id: "tokens-per-second",
    term: "Tokens per second",
    group: "Speed and cost",
    short:
      "How fast the model writes once it has started. Together with TTFT, it decides how long an answer takes.",
  },
  {
    id: "latency",
    term: "Latency",
    group: "Speed and cost",
    short: "How long something takes, usually in milliseconds (ms). 1,000 ms = 1 second.",
  },
  {
    id: "cache",
    term: "Cache",
    group: "Speed and cost",
    short:
      "A saved copy of a result so it doesn't have to be computed again. This app caches embeddings and reranks in Redis, keyed by the text.",
    example:
      '"embed 49 ms (cached)" under an answer means the question\'s vector came from the cache instead of Gemini.',
  },
  {
    id: "cached-input",
    term: "Cached input (prompt caching)",
    group: "Speed and cost",
    short:
      "When the start of a prompt repeats, providers can reuse their work on it and charge much less for those tokens.",
  },
  {
    id: "free-tier",
    term: "Free tier",
    group: "Speed and cost",
    short:
      "The free allowance a provider gives: so many requests per minute and per day. This app runs entirely on free tiers.",
    see: ["rate-limit"],
  },
  {
    id: "rate-limit",
    term: "Rate limit (429)",
    group: "Speed and cost",
    short:
      'A cap on how much you can use per minute or per day. Going over returns HTTP error 429, "too many requests".',
    long: "Per-minute limits clear in a minute, and the app retries. Daily limits only reset the next day; that's what stopped the judge on the evals page.",
  },
  {
    id: "cost-if-paid",
    term: "Cost if paid",
    group: "Speed and cost",
    short:
      "What a run would cost at the provider's paid list price. Your real cost is $0 on the free tier; this shows what it would be in production.",
  },

  // Measuring quality
  {
    id: "eval",
    term: "Eval",
    group: "Measuring quality",
    short:
      "A test for a RAG system: a fixed list of questions with known answers, run against one setup, scored, then compared with another setup.",
    long: 'Without evals, "it seems better" is a guess. With them, changing one setting gives a number you can compare.',
    see: ["hit-rate", "mrr", "faithfulness"],
  },
  {
    id: "hit-rate",
    term: "Hit rate",
    group: "Measuring quality",
    short:
      "The share of eval questions where the passage with the answer was found anywhere in the top-k. 88% means 22 of 25.",
  },
  {
    id: "mrr",
    term: "MRR",
    group: "Measuring quality",
    short:
      "Mean reciprocal rank: rewards finding the answer near the top. First place scores 1, second ½, third ⅓, missed 0, averaged over all questions.",
    long: 'Hit rate asks "was it found?"; MRR asks "how high?". 0.98 means the answer was almost always first.',
  },
  {
    id: "faithfulness",
    term: "Faithfulness",
    group: "Measuring quality",
    short:
      "Does the answer only say things the sources support? Scored 1–5 by a judge model. Low faithfulness means hallucination.",
  },
  {
    id: "relevance",
    term: "Answer relevance",
    group: "Measuring quality",
    short: "Does the answer actually address the question asked? Scored 1–5 by a judge model.",
  },
  {
    id: "llm-judge",
    term: "LLM-as-judge",
    group: "Measuring quality",
    short:
      "Using a stronger LLM to grade answers, because checking hundreds of answers by hand doesn't scale. Useful, but judges can be lenient or biased.",
  },
];

export const glossaryById = new Map(glossary.map((g) => [g.id, g]));
