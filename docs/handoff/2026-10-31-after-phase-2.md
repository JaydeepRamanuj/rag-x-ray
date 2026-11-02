# Handoff: after Phase 2 (31 Oct 2026)

Read this together with [the build plan](../RAG%20X-Ray%20—%20Build%20Plan.md), which is the spec, and [the process log](../../content/learn/process-log.mdx), which records every decision so far.

## Where things stand

| Phase | Status | Branch |
| --- | --- | --- |
| 0 Foundation | Done, reviewed, merged to `main`, deployed | `phase-0-foundation` (merged) |
| 1 Raw LLM call and streaming | Done, tested by Jd locally, pushed, **not merged** | `phase-1-llm-streaming` |
| 2 Ingestion and basic RAG | Done, pushed, **awaiting Jd's review**, not merged | `phase-2-ingestion-rag` (built on top of phase 1) |
| 3 Prompt inspector and token ledger | **Next.** Don't start until Jd says go | create `phase-3-inspector-ledger` from `phase-2-ingestion-rag` |

Merging: `main` only has Phase 0. Phases 1 and 2 are stacked branches. Once Jd approves, fast-forward `main` to `phase-2-ingestion-rag`; that brings in Phase 1 as well. Only merge or push to `main` when Jd says so.

All checks pass on `phase-2-ingestion-rag`: `pnpm lint`, `pnpm typecheck`, `pnpm test` (58 tests), `pnpm build`.

## What exists (one line each)

- `lib/config.ts`: every model ID, each model's lowest thinking level, free-tier limits, paid prices, ingestion limits, `estimateCostUsd()`.
- `lib/llm/`: Gemini and Groq adapters over raw `fetch` (`chatStream`, `chat`, `countTokens`), `retry.ts` (429/5xx backoff with retry-after).
- `lib/sse/`: hand-written SSE parser (`readSse`) and encoder, used by both server and client.
- `app/api/chat/route.ts`: streams our SSE events (`start → retrieval? → retry* → meta → upstream*/token* → usage → done|error`). `mode: "raw" | "rag"`, `topK`. Saves `runs` and `run_chunks` with `after()`.
- `lib/embeddings/`: batched Gemini embeddings, L2-normalised, cached in Upstash (`lib/cache.ts`, base64 Float32), with a per-minute token budget.
- `lib/chunking/recursive.ts`: recursive splitter with exact char offsets and overlap.
- `lib/ingest/` + `app/api/ingest/route.ts`: extract (unpdf for PDF) → clean → chunk → embed → `db.batch()` insert, streamed progress. Re-upload of the same content (sha256) replaces the old copy.
- `lib/retrieval/vector.ts`: raw-SQL cosine search over active chunk sets. `lib/prompt/builder.ts`: grounding system prompt, numbered sources in the last user message, `citedNumbers()`.
- UI: `/chat` (Use documents switch, top-k, Markdown answers with clickable citations, sources list, stats line, Stop), `/documents` (upload with password, progress, library, delete), `/runs/[id]/stream` (streaming debugger with replays), `/learn` (lessons 1–6 and 14 written).
- DB: migrations `0000`–`0003` are **already applied** to Neon. `runs` has extra `status` and `error` columns; `documents` has `content_hash` (unique) and `page_count`; `run_chunks` has a composite primary key.

## Environment facts

- Secrets are in **`.env`** (not `.env.local`); both are git-ignored. Never print values; check keys with `sed -E 's/=.+/=<set>/' .env`.
- `DATABASE_URL_UNPOOLED` isn't set; `drizzle.config.ts` derives it by dropping `-pooler` from the host.
- `APP_PASSWORD` isn't set locally, so uploads are open in dev. In production, uploads are refused until it's set.
- Vercel needs these env vars for Phases 1–2 to work there: `GEMINI_API_KEY`, `GROQ_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `APP_PASSWORD` (plus `DATABASE_URL`, already set).
- Tooling: pnpm 12 (install scripts must be allowed in `pnpm-workspace.yaml`), Node 22, Next 16.4 with Cache Components, Tailwind 4, shadcn (base-ui variant: `render` prop, not `asChild`), Drizzle 0.45, Vitest 5, zod 4.
- `.claude/launch.json` (git-ignored) has `dev` on port 3124 and `prod` on port 3123 for the browser pane.

## Verified API facts (probed live, 31 Oct 2026)

- **Gemini chat:** `…/models/{id}:streamGenerateContent?alt=sse`, header `x-goog-api-key`. `usageMetadata` is a running total on every chunk. Thinking is set with `generationConfig.thinkingConfig.thinkingLevel`. `gemini-3.5-flash-lite` accepts `minimal`; `gemini-3.8-flash` rejects `minimal` (400) and needs `low`. It also returned 503 "high demand" once.
- **Gemini embeddings:** `batchEmbedContents` with top-level `taskType` and `outputDimensionality`. The documented `embedContentConfig` is **silently ignored** (you get 3,072 dims). 768-dim output is **not normalised** (norm ≈ 0.59). There is **no usage** in the response.
- **Groq:** OpenAI dialect. `llama-3.1-8b-instant` is retired; the models are `openai/gpt-oss-20b` and `-120b` with `reasoning_effort: "low"` and `include_reasoning: false`. Usage arrives only in the final chunk and only with `stream_options.include_usage`. `x-ratelimit-*` headers come on every response. GPT-OSS bills about 80 input tokens of chat-template overhead.
- **Vercel Hobby:** functions get up to 300 s; request bodies are capped at 4.5 MB.

## Gotchas that cost time

- **Never run `pnpm format` while the dev server is running.** Mass file rewrites set off a reload loop that froze the browser pane. Stop the server, format, then restart.
- If the browser pane hangs, open a fresh tab (`tabs_create`) and close the stuck one.
- Next 16 + Cache Components:
  - no `export const runtime` or `dynamicParams`;
  - read `params` and query the DB inside `<Suspense>` (see `app/(app)/runs/[id]/stream/page.tsx` and `learn/[slug]/page.tsx`);
  - `usePathname` needs Suspense (sidebar);
  - call `await connection()` in dynamic GET handlers;
  - redirects go in `next.config.ts`;
  - don't use `next/link` in `mdx-components.tsx`.
- The dev server caches `generateStaticParams`; a newly written lesson can 404 in dev until a restart or build.
- The main column needs `min-w-0` (already on `SidebarInset`) or wide content stretches the page.
- In the Neon HTTP driver, transactions go through `db.batch([...])` (atomic, one round trip).

## Known open items (not bugs to fix unasked)

- `/api/chat` is public. Input is capped, but anyone with the URL can use the free quota. Ask Jd whether to put it behind `APP_PASSWORD`.
- Reasoning/thinking tokens are shown live but not stored in their own `runs` column (they're included in `output_tokens`). Phase 3's ledger may want a column.
- Unwritten lessons render a 404 page with status 200 (streamed inside Suspense).
- OpenRouter isn't wired up (optional). `countTokens()` exists in the adapters but isn't used yet; Phase 3 is the natural place.
- The debugger replays a run's saved `final_prompt` in raw mode, so it doesn't redo retrieval.

## Phase 3 scope (from the build plan)

- An **Inspect** button on every answer, opening `/runs/[id]/prompt`: the exact messages sent (system, retrieved context with source labels, history, question), each part with its token count as a stacked bar. Edit the system prompt or remove a chunk, then **Re-run** to compare answers side by side.
- A **`/ledger`** page: every run with embed, input, cached and output tokens, latency and estimated paid cost; a daily chart of usage against the free quota (Recharts); a **what-if** panel that recomputes a past run's cost with a different model, top-k or chunk size.
- **Lessons 9** (prompt construction) **and 11** (caching and cost control), plus a Phase 3 process-log entry.
- **Done when:** for any answer you can see the exact prompt and what it would have cost.

Suggested approach: per-part token counts can use `estimateTokens()` locally, labelled as estimates, beside the provider's exact total from `runs`. `run_chunks` already links each run to its chunks with rank and score. Re-run can POST to `/api/chat` with `mode: "raw"` and the edited messages.

## How Jd likes to work

- One phase at a time. At "Done when", stop, summarise what was built and what to test, and wait.
- Probe live APIs (tiny calls) before trusting docs, and record surprises in the process log.
- Small Conventional Commits on a phase branch with the Co-Authored-By trailer; push only when asked.
- Avoid subagents (the web-fetch helper for reading docs is fine). Hand-rolled first: no AI SDK or LangChain before Phase 6.
- Each phase writes its lessons (template: idea, how it works, in this app, try it, what you should see, interview angle, go deeper) using real numbers from the app, plus a process-log entry.
