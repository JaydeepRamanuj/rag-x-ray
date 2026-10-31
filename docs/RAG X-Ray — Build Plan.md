# RAG X-Ray — Build Plan

Oct 31, 2026 · @Jd

## Overview

RAG X-Ray is a chat-over-your-documents app where every pipeline stage is visible, adjustable and measured. You learn by changing one setting and watching what it does to chunks, retrieval, prompt size, tokens, latency and answer quality.

The chat is the shell. The seven modules around it (chunking, embeddings, retrieval, prompt, streaming, tokens, evals) are the product, and the Learn page explains each one with links back into the app.

**Guiding principles**

- **Hand-rolled first, library second.** Each stage is written with plain `fetch` and SQL. Later, one stage is rewritten with the Vercel AI SDK so you can compare what it hides.
- **Every number is shown.** Token counts, scores, latency and cost appear next to the thing that produced them.
- **Provider-agnostic.** All LLM and embedding calls go through one small adapter, so swapping providers (free tiers change often) is a config change.
- **Zero cost.** Every service runs on a free tier with no card required where possible.
- **Every phase ships.** Each phase ends with something usable, so a few hours a week still adds up.

## Instructions for Claude Code

This doc is the spec. Build Phase 0 only, then stop and wait for Jd's go-ahead before each later phase.

**Before writing any code**

1. Read the whole doc and ask any clarifying questions in one batch.
2. Check current official docs for every model ID, API shape and free-tier limit you rely on. They change often; this doc's values were checked on 31 Oct 2026.
3. Propose the Phase 0 task list, then start.

**Working rules**

- **One phase at a time.** At each phase's "Done when", stop, summarise what was built and what Jd should test, and wait.
- **Hand-rolled first.** No Vercel AI SDK, LangChain or LlamaIndex before Phase 6. LLM, embedding and streaming code uses plain `fetch`.
- **Teach as you build.** Each phase also writes its Learn lessons (see Learn page) and adds an entry to Lesson 14, the process log. Add short comments in code explaining *why*, not *what*.
- **Secrets.** Create `.env.example` with empty values; Jd fills `.env.local`. Never print, log or commit secrets.
- **Git.** One branch per phase (`phase-0-foundation`, ...), small commits with Conventional Commit messages, merge after Jd reviews.
- **Tooling.** pnpm, Node 20+, latest stable Next.js, strict TypeScript, ESLint + Prettier. Vitest for pure logic: chunkers, SSE parser, RRF, eval metrics, cost maths.
- **Free-tier care.** Throttle and back off on 429s; cache embeddings and reranks; never loop API calls in tests (mock them).
- **Subagents.** Avoid them. If one is truly needed, use a mid-tier model such as Sonnet.

**Environment file** (`.env.example`)

```bash
# LLM providers
GEMINI_API_KEY=
GROQ_API_KEY=
COHERE_API_KEY=
OPENROUTER_API_KEY=          # optional

# Database (Neon): pooled for the app, direct for migrations
DATABASE_URL=
DATABASE_URL_UNPOOLED=

# Cache (Upstash Redis)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Simple guard for upload and eval routes
APP_PASSWORD=
```

**Folder layout**

```text
app/
  (app)/chat, lab/chunking, lab/embeddings, lab/retrieval,
  runs/[id]/prompt, runs/[id]/stream, ledger, evals, learn/[slug]
  api/health, api/chat, api/ingest, api/retrieve, api/evals
lib/
  config.ts                 # model IDs, limits, paid list prices
  llm/                      # types.ts, gemini.ts, groq.ts, openrouter.ts, index.ts
  embeddings/               # gemini.ts, local.ts (Transformers.js)
  chunking/                 # fixed, recursive, sentence, semantic
  retrieval/                # vector.ts, keyword.ts, hybrid.ts (RRF), rerank.ts
  prompt/                   # builder + token budgeting
  tokens/                   # local estimates, cost maths
  sse/                      # server encoder, client parser
  db/                       # schema.ts (Drizzle), client.ts, raw SQL queries
  cache.ts                  # Upstash wrapper
content/learn/*.mdx         # Learn page lessons
drizzle/                    # migrations
```

**Architecture in text** (the diagram below may not paste): Ingestion is upload → extract text → chunk → embed (cache in Upstash) → store chunks and vectors in Neon. Query is question → embed → retrieve top-k (vector + keyword, RRF) → optional rerank → build prompt → stream from Gemini or Groq over SSE → browser. Every query is saved in `runs`.

## What you need to provide

You provide six free accounts, a handful of documents, and 20 minutes reviewing an eval set. Everything else is decided below.

| Service | What to do | Env var(s) | Required? |
| --- | --- | --- | --- |
| [Google AI Studio](https://aistudio.google.com) | Create an API key. Do **not** link billing, so it stays on the free tier. | `GEMINI_API_KEY` | Yes |
| [Groq](https://console.groq.com) | Sign up and create an API key. No card needed. | `GROQ_API_KEY` | Yes |
| [Cohere](https://dashboard.cohere.com) | Sign up; a trial key is issued automatically. | `COHERE_API_KEY` | Yes (Phase 4) |
| [Neon](https://neon.com) | Create a free project. Copy both the pooled and the direct (unpooled) connection strings. | `DATABASE_URL`, DATABASE\_URL\_UNPOOLED | Yes |
| [Upstash](https://upstash.com) | Create a free Redis database. Copy the REST URL and token. | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Yes (Phase 2) |
| GitHub + [Vercel](https://vercel.com) | An empty repo named `rag-xray`, and a Vercel Hobby account linked to GitHub. | none | Yes |
| [OpenRouter](https://openrouter.ai) | Optional third provider for comparing more free models. | `OPENROUTER_API_KEY` | Optional |

**Documents.** 5 to 20 text, Markdown or PDF files, about 50 to 300 pages in total. Use non-confidential material: Gemini's free tier may use inputs to improve Google's models. Your own interview-prep notes or public docs (React, Next.js, Postgres) work well.

**Eval set.** I'll draft 25 question-and-answer pairs from your documents in Phase 5. You check them and fix any that are wrong.

**Never commit keys.** They go in `.env.local` (git-ignored) and in Vercel's project environment variables.

## Free-tier models and services

Gemini is the default because it covers both chat and embeddings on one free key. Groq is the second chat provider because it is very fast and uses the OpenAI-style API, so you learn two API shapes.

| Role | Pick | Free limits (as published) | Why this one |
| --- | --- | --- | --- |
| Chat, default | [Gemini](https://ai.google.dev/gemini-api/docs/rate-limits) Flash-Lite | Per model, per project; daily quota resets at midnight Pacific. Exact numbers show in AI Studio. | Returns exact token usage per call. Pro models are no longer on the free tier, so stay on Flash and Flash-Lite. |
| Chat, eval judge | Gemini Flash | Lower requests per minute than Flash-Lite | Stronger model for grading answers in Eval mode |
| Chat, comparison | [Groq](https://benchlm.ai/free-tier/groq) `llama-3.1-8b-instant` | 30 req/min, 14,400 req/day, 6,000 tokens/min | Very high daily cap and fast streaming; ideal for the streaming debugger |
| Chat, bigger open model | Groq `openai/gpt-oss-120b` | 30 req/min, 1,000 req/day, 8,000 tokens/min, 200,000 tokens/day | Compare a large open model against Gemini on the same prompt |
| Chat, optional | [OpenRouter](https://benchlm.ai/free-tier/openrouter) `:free` models | 20 req/min, 50 req/day (1,000/day after a one-time $10 top-up) | Try many models through one API; low daily cap |
| Embeddings, default | [Gemini](https://smithery.ai/skills/secondsky/google-gemini-embeddings) `gemini-embedding-001` at 768 dims | About 100 req/min, 30,000 tokens/min, 1,000 req/day; 2,048 tokens per input | Supports task types (`RETRIEVAL_DOCUMENT` vs `RETRIEVAL_QUERY`) and shorter vectors |
| Embeddings, local | `all-MiniLM-L6-v2` via Transformers.js, 384 dims | No limits; runs on your server | Shows that embeddings are just a model you can run yourself, and lets you compare quality |
| Reranker | [Cohere](https://benchlm.ai/free-tier/cohere) Rerank (trial key) | 10 req/min, 1,000 API calls/month total | The standard reranker; cache results to save calls |
| Database + vectors | [Neon](https://neon.com/docs/changelog/2026-10-02) Postgres with pgvector | 1 GB per project, 100 CU-hours/month, sleeps after 5 min idle | Vectors live next to your data in plain SQL |
| Cache | [Upstash](https://upstash.com/blog/upstash-vs-redis-cloud-a-2026-comparison) Redis | 256 MB, 500,000 commands/month | Caches embeddings and rerank results; HTTP client works on Vercel |
| Hosting | Vercel Hobby | Free for personal projects | Native Next.js streaming |

Free-tier numbers change often. The app reads model IDs and prices from one config file, so a change is a one-line edit. Check the provider's console for the limits on your own account.

**Cost display.** Your real cost is ₹0. The token ledger still shows "what this would cost on the paid tier", using list prices kept in the same config file.

## Architecture and tech decisions

One Next.js app does everything: the UI, the API routes, and the ingestion work. Two pipelines share the same database: ingestion (document → chunks → vectors) and query (question → retrieval → prompt → streamed answer).

&#91;embedded content: RAG X-Ray architecture · ingestion and query pipelines\]

Ingestion runs once per document; the query pipeline runs on every question and records each step in `runs`.

| Area | Decision | Reason |
| --- | --- | --- |
| Framework | Next.js (App Router), TypeScript, Tailwind, shadcn/ui | Your main stack |
| API style | Route Handlers (`app/api/*/route.ts`) on the Node runtime | Transformers.js and PDF parsing need Node, not Edge |
| LLM access | A hand-written `lib/llm/` adapter: `chat()`, `chatStream()`, `embed()`, `countTokens()`, with a Gemini and a Groq implementation | Raw `fetch`, so you see every request and response |
| Streaming | Server-Sent Events from the route handler to the browser, parsed with a hand-written reader | You learn the wire format. The Vercel AI SDK comes in Phase 6 as a comparison |
| DB access | Drizzle ORM for tables; raw SQL for vector and full-text queries | Type-safe CRUD, while the retrieval SQL stays visible |
| Vector search | pgvector, cosine distance, HNSW index | Industry standard; teaches approximate nearest-neighbour search |
| Keyword search | Postgres full-text search (`tsvector`, `ts_rank`) as a BM25 stand-in | No extra service; hybrid search in one database |
| Hybrid merge | Reciprocal Rank Fusion (RRF), k = 60 | Simple, explainable, no score normalisation needed |
| PDF parsing | `unpdf` | Works on serverless Node |
| Tokenising | Provider token counts for the ledger, plus `gpt-tokenizer` for instant local estimates | Shows that tokenisers differ between models |
| 2D projection | `umap-js` in the browser, PCA as a fallback | Runs client-side; no extra API |
| Charts | Recharts | Works with shadcn |
| Auth | None. Single user, with an upload password in an env var | It's a learning app; auth would be a distraction |
| Ingestion | Synchronous per document, with progress streamed over SSE | Avoids a job queue; fits Vercel's function time limit for small files |

## Data model

Seven tables. The key idea is `chunk_sets`: one document can be chunked several ways at once, so the chunking lab and evals can compare strategies on the same text.

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  source_type  text NOT NULL,           -- 'pdf' | 'md' | 'txt'
  raw_text     text NOT NULL,
  token_count  int  NOT NULL,
  created_at   timestamptz DEFAULT now()
);

-- One row per chunking experiment on a document
CREATE TABLE chunk_sets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  uuid REFERENCES documents ON DELETE CASCADE,
  strategy     text NOT NULL,           -- 'fixed' | 'recursive' | 'sentence' | 'semantic'
  chunk_size   int,                     -- in tokens
  overlap      int,
  is_active    boolean DEFAULT false,   -- the set chat uses
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE chunks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_set_id    uuid REFERENCES chunk_sets ON DELETE CASCADE,
  document_id     uuid REFERENCES documents ON DELETE CASCADE,
  ordinal         int  NOT NULL,
  content         text NOT NULL,
  token_count     int  NOT NULL,
  start_char      int, end_char int,    -- to highlight the chunk in the source
  embedding       vector(768),          -- gemini-embedding-001
  embedding_local vector(384),          -- all-MiniLM-L6-v2
  tsv             tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
);
CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON chunks USING hnsw (embedding_local vector_cosine_ops);
CREATE INDEX ON chunks USING gin (tsv);

-- Every chat request, fully recorded for the inspectors and ledger
CREATE TABLE runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question       text NOT NULL,
  config         jsonb NOT NULL,        -- provider, model, top_k, method, rerank, temperature...
  final_prompt   jsonb NOT NULL,        -- exact messages sent
  answer         text,
  embed_tokens   int, input_tokens int, output_tokens int, cached_tokens int,
  ttft_ms        int, total_ms int,
  est_cost_usd   numeric(10,6),         -- at paid list price
  created_at     timestamptz DEFAULT now()
);

CREATE TABLE run_chunks (
  run_id    uuid REFERENCES runs ON DELETE CASCADE,
  chunk_id  uuid REFERENCES chunks ON DELETE CASCADE,
  method    text,                       -- 'vector' | 'keyword' | 'hybrid' | 'rerank'
  rank      int, score real,
  used_in_prompt boolean
);

CREATE TABLE eval_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question         text NOT NULL,
  expected_answer  text NOT NULL,
  source_text      text NOT NULL        -- passage that holds the answer (survives re-chunking)
);

CREATE TABLE eval_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config        jsonb NOT NULL,
  results       jsonb NOT NULL,         -- per item: retrieved ids, hit, faithfulness, judge reason
  hit_rate      real, mrr real, faithfulness real, answer_relevance real,
  total_tokens  int,
  created_at    timestamptz DEFAULT now()
);
```

Eval items store the answer's source passage as text, not a chunk ID. A retrieved chunk counts as a hit if it contains most of that passage, so evals still work after re-chunking.

## Modules

Each module is a page in the app with its own controls. Every chat answer has an **Inspect** button that opens the same run in the Prompt inspector, Retrieval arena and Token ledger.

### 1. Chunking lab (`/lab/chunking`)

- **You see:** one document split four ways (fixed, recursive, sentence, semantic), side by side, with chunk boundaries highlighted and each chunk's token count.
- **Controls:** chunk size (100 to 1,000 tokens), overlap (0 to 30%), semantic threshold.
- **Stats:** chunk count, average and spread of size, how many sentences were cut mid-way.
- **You learn:** why chunk boundaries decide retrieval quality, and the trade-off between precision (small chunks) and context (large chunks).
- **Built by hand:** all four splitters in `lib/chunking/`. Semantic splitting embeds each sentence and cuts where similarity between neighbours drops.

### 2. Embedding explorer (`/lab/embeddings`)

- **You see:** every chunk as a dot in 2D, coloured by document. Type a query and it appears as a star; its 5 nearest chunks are linked to it.
- **Controls:** Gemini vs local model, 768 vs 256 dimensions, UMAP vs PCA.
- **Extras:** a "similarity playground": type two sentences and see their cosine similarity. Try synonyms, negation ("is" vs "is not") and different languages.
- **You learn:** what a vector is, cosine similarity, why negation fools embeddings, and that a 2D view distorts distances.

### 3. Retrieval arena (`/lab/retrieval`)

- **You see:** one query run through vector, keyword, hybrid (RRF) and hybrid + rerank, in four columns. Each shows its top 10 chunks with scores and rank changes.
- **Controls:** top-k, which embedding model, rerank on or off.
- **You learn:** where keyword search beats vectors (exact names, error codes), how RRF merges lists, and what a cross-encoder reranker adds.

### 4. Prompt inspector (`/runs/[id]/prompt`)

- **You see:** the exact messages sent: system prompt, retrieved context with source labels, chat history, the question. Each part shows its token count as a stacked bar.
- **Controls:** edit the system prompt or remove a chunk, then **Re-run** to compare answers side by side.
- **You learn:** context-window budgeting, citation prompting, the "lost in the middle" effect, and how history makes prompts grow.

### 5. Streaming debugger (`/runs/[id]/stream`)

- **You see:** raw SSE events on the left with timestamps, rendered text on the right. A timeline marks request sent, first token, last token.
- **Stats:** time to first token, tokens per second, total time, same prompt on Gemini vs Groq.
- **Controls:** a Stop button using `AbortController`; a "slow network" toggle.
- **You learn:** how SSE works, chunk framing, parsing partial events, back-pressure and cancellation.

### 6. Token ledger (`/ledger`)

- **You see:** every run with embedding, input, cached and output tokens; latency; and estimated paid-tier cost. A daily chart shows usage against your free quota.
- **What-if panel:** pick a past run and recompute cost with a different model, top-k or chunk size.
- **You learn:** that input usually dominates in RAG, why output tokens cost more, how caching helps, and how to estimate tokens before sending.

### 7. Eval mode (`/evals`)

- **You see:** your eval set, a Run button, and a table of past runs with hit rate, MRR, faithfulness and answer relevance. Click a run to see each question's retrieved chunks and the judge's reasoning.
- **Metrics:** hit rate@k and MRR (retrieval quality, no LLM needed); faithfulness and answer relevance (graded by Gemini Flash as judge).
- **Controls:** "Compare" picks two runs and shows which questions improved or got worse.
- **You learn:** offline evaluation, LLM-as-judge and its biases, and changing one variable at a time.

Eval runs are slow on purpose: one question at a time with a delay, to stay within rate limits.

## Learn page

The Learn page (`/learn`) is a set of MDX lessons, one per concept, ordered as a course. Each lesson follows the same template:

1. **The idea:** the concept in plain words, with one diagram.
2. **How it works:** the mechanics, maths where it helps (cosine similarity, RRF formula, MRR).
3. **In this app:** the files and functions that implement it, with short code excerpts and GitHub links.
4. **Try it:** a button that opens the matching module with settings pre-loaded.
5. **What you should see:** the expected result, so you can tell if you understood.
6. **Interview angle:** two or three questions this concept comes up in, with short answers.
7. **Go deeper:** links to papers and official docs.

**Lessons**

1. How an LLM API call works: messages, roles, parameters, the response body
2. Tokens and tokenisers: why counts differ, input vs output pricing, context windows
3. Streaming: SSE format, `ReadableStream`, parsing partial events, cancellation
4. Embeddings: what a vector means, dimensions, task types, cosine similarity
5. Chunking: four strategies and their trade-offs
6. Vector databases: pgvector, HNSW vs exact search, distance operators
7. Keyword search and hybrid retrieval: full-text search, BM25 idea, RRF
8. Reranking: bi-encoders vs cross-encoders, cost vs quality
9. Prompt construction: context budgeting, citations, "lost in the middle", grounding instructions
10. Evaluating RAG: hit rate, MRR, faithfulness, LLM-as-judge pitfalls
11. Caching and cost control: embedding cache, prompt caching, rate limits and backoff
12. Libraries vs hand-rolled: what the Vercel AI SDK does for you
13. The full pipeline: one request traced end to end, with timings from a real run
14. Process log: the decisions made while building, what broke and why

Lessons are written in the same phase as the module they describe, while the details are fresh. Lesson 14 is updated at the end of each phase.

## Build plan

Seven phases, each ending with a working, deployed app. At a few hours a week, plan on roughly one phase per one to two weeks.

1. **Phase 0: Foundation**
   - Next.js + TypeScript + Tailwind + shadcn scaffold; app shell with sidebar.
   - Neon connected, Drizzle schema and migrations, pgvector enabled.
   - `lib/config.ts` with model IDs, limits and paid list prices.
   - Deployed to Vercel.
   - **Done when:** the empty app is live and `/api/health` shows the database is reachable.
2. **Phase 1: Raw LLM call and streaming**
   - `lib/llm/` adapter with Gemini and Groq, using raw `fetch`.
   - `/api/chat` streams SSE; a hand-written client parser renders tokens.
   - Every call saved to `runs` with token counts and timings.
   - Streaming debugger page. Lessons 1 to 3.
   - **Done when:** you can chat with either provider, stop mid-stream, and see TTFT and token counts.
3. **Phase 2: Ingestion and basic RAG**
   - Upload text, Markdown or PDF; extract text; recursive chunking; Gemini embeddings in batches; store in pgvector.
   - Embedding cache in Upstash, keyed by a hash of the text.
   - Vector retrieval feeds the chat prompt, with citations.
   - Lessons 4 to 6.
   - **Done when:** questions about your documents get cited answers, and re-uploading a file uses the cache.
4. **Phase 3: Prompt inspector and token ledger**
   - Inspect button on every answer; prompt breakdown with token bars; edit and re-run.
   - Ledger page with daily usage chart and what-if cost panel.
   - Lessons 9 and 11.
   - **Done when:** for any answer you can see the exact prompt and what it would have cost.
5. **Phase 4: Chunking lab and retrieval arena**
   - All four chunkers; `chunk_sets` so strategies coexist.
   - Full-text search, RRF hybrid, Cohere rerank (cached).
   - Local embeddings with Transformers.js.
   - Lessons 5 (expanded), 7 and 8.
   - **Done when:** you can show a query where hybrid beats vector, and one where rerank fixes the order.
6. **Phase 5: Eval mode**
   - Draft 25 eval pairs from your documents; you review them.
   - Hit rate and MRR runner; LLM-as-judge for faithfulness and relevance; run comparison view.
   - Lesson 10.
   - **Done when:** you have a baseline score and one setting change that measurably improves it.
7. **Phase 6: Embedding explorer, library comparison, polish**
   - UMAP plot and similarity playground.
   - Rewrite `/api/chat` with the Vercel AI SDK on a separate route; compare the code side by side.
   - Lessons 12 to 14; README with architecture diagram and screenshots.
   - **Done when:** the Learn page is complete and the app is portfolio-ready.

Phases 1 to 3 already make a solid portfolio piece. Phases 4 and 5 are what make it stand out in interviews.

## Risks and free-tier gotchas

The main risk is hitting rate limits, not cost. Each item below has a built-in fix.

| Risk | Fix in the app |
| --- | --- |
| 429 errors from Gemini or Groq | Retry with exponential backoff that respects the `retry-after` header; a fallback provider toggle. Rate-limit headers are shown in the streaming debugger. |
| Embedding a large PDF uses up the daily embedding quota | Batch requests, cache by text hash in Upstash, cap uploads at about 300 pages in total |
| Cohere trial cap of 1,000 calls a month | Cache rerank results per query + chunk set; rerank off by default in chat, on in the arena |
| Neon compute sleeps after 5 minutes idle | The first query after idle is slower; the debugger labels this "cold start" so you learn what it is |
| Vercel function time limit on long ingestion | Process one document per request and stream progress; skip files over 50 pages per upload |
| Free-tier data use | Gemini's free tier may use inputs to improve its models, so only upload non-confidential documents |
| Model IDs retired or limits changed | All IDs and prices live in `lib/config.ts`; one edit fixes it |
| Changing embedding model or dimensions breaks stored vectors | Separate columns per model; a "re-embed" button per chunk set |

**Stretch goals** (only after Phase 6)

- Query rewriting: turn follow-up questions into standalone queries using chat history, and measure the effect in evals.
- Prompt caching on repeated context, shown in the ledger as cached tokens.
- Tool calling: let the model decide when to search, a first step towards agentic RAG.
- Structured output: answers as JSON with citations validated by Zod.
