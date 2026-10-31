# Handoff: after Phase 3 (31 Oct 2026)

Read this together with [the build plan](../RAG%20X-Ray%20—%20Build%20Plan.md), which is the spec, and [the process log](../../content/learn/process-log.mdx), which records every decision so far. [The Phase 2 handoff](./2026-10-31-after-phase-2.md) still holds for everything this file doesn't change.

## Where things stand

| Phase | Status | Branch |
| --- | --- | --- |
| 0 Foundation | Done, reviewed, merged to `main`, deployed | `phase-0-foundation` (merged) |
| 1 Raw LLM call and streaming | Done, pushed, **not merged** | `phase-1-llm-streaming` |
| 2 Ingestion and basic RAG | Done, pushed, **not merged** | `phase-2-ingestion-rag` (on top of phase 1) |
| 3 Prompt inspector and token ledger | Done, pushed, **awaiting Jd's review**, not merged | `phase-3-inspector-ledger` (on top of phase 2) |
| 4 Chunking lab and retrieval arena | **Next.** Don't start until Jd says go | create `phase-4-chunking-retrieval` from `phase-3-inspector-ledger` |

Merging: `main` only has Phase 0. Phases 1–3 are stacked branches. Once Jd approves, fast-forward `main` to `phase-3-inspector-ledger`; that brings in phases 1 and 2 as well. Only merge or push to `main` when Jd says so.

All checks pass on `phase-3-inspector-ledger`: `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm test` (76 tests), `pnpm build`.

## What Phase 3 added (one line each)

- `drizzle/0004_ledger_usage.sql` (**already applied** to Neon): `runs.reasoning_tokens`, and an `ingest_usage` table (one row per upload that reached embedding; `document_id` is `ON DELETE SET NULL`).
- `lib/config.ts`: Gemini 3.5 Flash-Lite free limits from Jd's AI Studio (15 RPM, 250K TPM, 500 RPD). Gemini 3.8 Flash's are still blank.
- `app/api/chat/route.ts`: accepts `source: "inspector"`, `parentRunId` (saved in `config`), `question` (readable question for raw re-runs) and `chunks` (saved to `run_chunks` with `used_in_prompt`). Saves `reasoning_tokens`.
- `app/api/ingest/route.ts`: logs embedding usage to `ingest_usage`, even if storing then fails.
- `app/api/tokens/route.ts`: counts each prompt part with the model's own tokenizer (Gemini `countTokens`, GPT-OSS o200k_harmony locally).
- `lib/prompt/builder.ts`: `systemPrompt` option, `sourceLabel()`, `formatSourceBlocks()`, `ragUserMessage()`, `SOURCES_HEADER` / `QUESTION_PREFIX`.
- `lib/prompt/anatomy.ts`: `splitPrompt()` (rebuilds sources from `run_chunks`, or parses them back out of the text), `promptParts()`, `rebuildMessages()`.
- `lib/tokens/cost.ts`: `whatIfCost()` and `embedCostUsd()`. Client-safe; `lib/ledger/inputs.ts` (server-only, uses the tokenizer) builds its input from a run.
- `lib/db/runs.ts`: `getRunChunks()`, `getReruns()`, `summarizeRun()` / `RunSummary` (plain JSON for client components). `lib/db/ledger.ts`: `listRuns()`, `dailyUsage()` (raw SQL, Pacific days, busiest minute).
- `lib/ledger/days.ts`: `dayIn()`, `lastDays()` (DST-safe).
- UI: `/runs/[id]/prompt` (`components/prompt-inspector/`), `/ledger` (`components/ledger/`), an **Inspect** button in chat (the stream link is now "Stream"), a link from the debugger to the inspector, `components/markdown.tsx`, `components/ui/chart.tsx` (shadcn, Recharts 3.8.0).
- Lessons 9 (`prompt-construction`) and 11 (`caching-and-cost`), plus the Phase 3 process-log entry.

## Environment facts (new or changed)

- **pnpm store:** `node_modules` is linked from `/home/jd/work/.pnpm-store`, but plain `pnpm add` now wants `~/.local/share/pnpm/store` and fails with `ERR_PNPM_UNEXPECTED_STORE`. Use `pnpm add <pkg> --store-dir /home/jd/work/.pnpm-store`. For `pnpm shadcn add`, install the dependency that way first, then run `yes n | npm_config_store_dir=/home/jd/work/.pnpm-store pnpm shadcn add <component>`. The `yes n` declines overwriting existing ui files such as `card.tsx`.
- **Disk:** `/home/jd/work` filled up completely mid-phase (Jd freed about 3 GB). If installs or tests fail with ENOSPC, stop and ask; don't delete anything.
- Everything else from the Phase 2 handoff still applies: secrets in `.env`, `APP_PASSWORD` unset locally, `.claude/launch.json` has `dev` (3124) and `prod` (3123).

## Verified API facts (probed live, 31 Oct 2026)

- **Gemini countTokens** returns `{ totalTokens, promptTokensDetails }` and no rate-limit headers. Gemini's tokenizer counts digits one by one ("12345 67890" is 12 tokens; o200k gives 5). It counts prose about 10% above o200k, and number-heavy text about 22% above.
- **Gemini implicit caching works on the free tier.** An identical 6,217-token prompt reported `cachedContentTokenCount: 4071` about 20 s after the first call; a repeat 3 s after got 0. It caches a prefix in blocks. Gemini adds almost no chat-template overhead: per-part counts summed to 2,263 against 2,260 billed.
- **Groq GPT-OSS 20B reported no cached tokens** (`prompt_tokens_details` absent). Two ~5k-token requests seconds apart hit the 8,000 TPM limit with a 429 ("try again in 12.315s").

## Gotchas that cost time

- **A hidden browser pane gets no `requestAnimationFrame`.** React 19 reveals streamed Suspense content on an animation frame, so in a hidden pane the page stays on its fallback (the HTML sits in `<div hidden id="S:1">`). Recharts also measures 0×0, and screenshots come back stale or blank. Check `tabs_context` ("pane is hidden") before debugging a "stuck" page; use curl or `get_page_text` for checks that don't need rendering.
- Programmatically setting a `<select>` value doesn't reach React state; use `form_input`.
- React Compiler lint: no `Math.random()` and no counters mutated inside `map()` during render.
- Still true: **never run `pnpm format` (or `prettier --write`) while the dev server is running.** `prettier --check` is fine, and so is fixing a file by hand.
- Runs are saved with `after()`, so a page that loads a run straight after an answer can beat the insert. The inspector retries the lookup for about 2 s; the stream debugger doesn't.

## Known open items (not bugs to fix unasked)

- The ledger's quota-axis rule (the axis ends exactly at the daily limit while usage is under it) was changed last and **not checked visually** (pane hidden). Jd is testing it.
- `/api/chat` and `/api/tokens` are public. Jd chose to leave chat public for now.
- `ingest_usage` holds one 15-token test row (`ingest-log-test.txt`) from verifying the logging. Uploads before Phase 3 aren't logged.
- The what-if holds output tokens constant and marks cross-provider results approximate. Re-runs can't reorder sources (Jd picked "spec + model" scope), so "lost in the middle" is explained but not testable by reordering.
- Old runs (before Phase 3) have `reasoning_tokens` null.
- Unwritten lessons still render a 404 page with status 200. OpenRouter is still not wired up. The debugger still replays in raw mode without redoing retrieval.

## Phase 4 scope (from the build plan)

- All four chunkers (fixed, recursive, sentence, semantic) in `lib/chunking/`; `chunk_sets` so strategies coexist on the same document; the chunking lab at `/lab/chunking` (side by side, boundaries highlighted, size and overlap controls, stats).
- Postgres full-text search (`tsv` column and GIN index already exist), RRF hybrid (k = 60, `defaults.rrfK`), Cohere Rerank (`rerankModel` in config; re-check its pricing and the trial limits), cached in Upstash per query + chunk set.
- Local embeddings with Transformers.js (`all-MiniLM-L6-v2`, 384 dims, the `embedding_local` column already exists).
- The retrieval arena at `/lab/retrieval`: vector, keyword, hybrid and hybrid + rerank in four columns.
- Lessons 5 (expanded), 7 and 8, plus a Phase 4 process-log entry.
- **Done when:** you can show a query where hybrid beats vector, and one where rerank fixes the order.

Things to ask Jd before starting: is a `COHERE_API_KEY` in `.env` yet (check with `sed -E 's/=.+/=<set>/' .env`)? Should the chunking lab write new chunk sets to the database or compute in memory only? Should the semantic chunker use Gemini embeddings (quota) or the local model? Should chat get a retrieval-method switch, or stay on vector?

## How Jd likes to work

- One phase at a time. At "Done when", stop, summarise what was built and what to test, and wait.
- Ask clarifying questions in one batch before starting, and propose a task list.
- Probe live APIs (tiny calls) before trusting docs, and record surprises in the process log.
- Small Conventional Commits on a phase branch with the Co-Authored-By trailer; push only when asked.
- Avoid subagents (the web-fetch helper for reading docs is fine). Hand-rolled first: no AI SDK or LangChain before Phase 6.
- Each phase writes its lessons (template: idea, how it works, in this app, try it, what you should see, interview angle, go deeper) using real numbers from the app, plus a process-log entry.
