# Handoff: after Phase 4 (31 Oct 2026)

Read this together with [the build plan](../RAG%20X-Ray%20—%20Build%20Plan.md), which is the spec, and [the process log](../../content/learn/process-log.mdx), which records every decision so far. The [Phase 3](./2026-10-31-after-phase-3.md) and [Phase 2](./2026-10-31-after-phase-2.md) handoffs still hold for everything this file doesn't change.

## Where things stand

| Phase | Status | Branch |
| --- | --- | --- |
| 0 Foundation | Done, reviewed, merged to `main`, deployed | `phase-0-foundation` (merged) |
| 1 Raw LLM call and streaming | Done, pushed, **not merged** | `phase-1-llm-streaming` |
| 2 Ingestion and basic RAG | Done, pushed, **not merged** | `phase-2-ingestion-rag` (on top of phase 1) |
| 3 Prompt inspector and token ledger | Done, pushed, **not merged** | `phase-3-inspector-ledger` (on top of phase 2) |
| 4 Chunking lab and retrieval arena | Done, **not pushed**, awaiting Jd's review | `phase-4-chunking-retrieval` (on top of phase 3) |
| 5 Eval mode | **Next.** Don't start until Jd says go | create `phase-5-evals` from `phase-4-chunking-retrieval` |

Merging: `main` only has Phase 0. Phases 1–4 are stacked branches. Once Jd approves, fast-forward `main` to `phase-4-chunking-retrieval`; that brings in phases 1–3 as well. Only push, or merge to `main`, when Jd says so.

All checks pass on `phase-4-chunking-retrieval`: `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm test` (98 tests), `pnpm build`.

## What Phase 4 added (one line each)

- `drizzle/0005_chunk_sets_threshold.sql` (**already applied** to Neon): `chunk_sets.threshold real`, the semantic threshold a set was saved with.
- `lib/chunking/`: `types.ts` (`Chunk`, `STRATEGIES`), `spans.ts` (shared binary-search cut and merge-with-overlap, moved out of `recursive.ts`), `fixed.ts`, `sentence.ts` (`Intl.Segmenter` plus an abbreviation fix), `semantic.ts` (windowed neighbour similarity, injected `embed`), `index.ts` (`chunkText()`, `DEFAULT_SEMANTIC_THRESHOLD = 0.4`), `stats.ts` (`chunkStats()`, including sentences cut), `segments.ts` (highlight stretches, `cutsWord()`), `lab.ts` (`runLab()`, `overlapTokens()`).
- `lib/embeddings/local.ts`: all-MiniLM-L6-v2 through `@huggingface/transformers` 4.3.2, fp32, tokenizer and model called directly with a 256-token cap, hand-written `meanPool()`. `embedLocalMemo()` memoises up to 20k vectors in process. `localEmbeddingsStatus()` exists but nothing uses it yet.
- `lib/retrieval/`: `vector.ts` (now takes `model: "gemini" | "local"` and `chunkSetIds`), `keyword.ts` (AND→OR `tsquery`, `ts_rank_cd`, `explainQuery()`), `hybrid.ts` (`reciprocalRankFusion()`, keeps per-list ranks), `rerank.ts` (Cohere `/v2/rerank`, Upstash cache per query + candidate ids, monthly call counter), `methods.ts` (client-safe `METHODS`), `index.ts` (`retrieveAll()` for the arena, `retrieveForChat()`).
- `lib/cache.ts`: `increment()` and `readCounter()`. `lib/config.ts`: `defaults.candidates = 20`, rerank price confirmed.
- `lib/db/chunk-sets.ts`: list with vector coverage, insert (inactive), activate (atomic), delete (refuses the active set), `chunksMissing()`, `setEmbeddings()` (one `unnest` UPDATE).
- `lib/ingest/embed-chunks.ts`: Gemini embedding with `ingest_usage` logging; local embedding that returns undefined if the model can't load. Uploads now store local vectors too.
- API: `POST /api/lab/chunk` (preview all four strategies, public, no quota), `GET/POST /api/chunk-sets`, `PATCH/DELETE /api/chunk-sets/[id]`, `POST /api/chunk-sets/[id]/embed`, `POST /api/retrieve`. Writes and rerank need `APP_PASSWORD` (open in dev).
- `/api/chat`: `retrieval: "vector" | "keyword" | "hybrid"` and `rerank` (password-guarded). Both are saved in `config`; `run_chunks.method` is the method, or `"rerank"`. The `retrieval` SSE event now has `method` and `rerank`.
- UI: `/lab/chunking` (`components/chunking-lab/`), `/lab/retrieval` (`components/retrieval-arena/`), method select and Rerank switch in chat. Both lab pages read query params for lesson "Try it" links (`?doc=&size=&overlap=&threshold=`, `?q=&k=&model=&rerank=0`).
- Lessons 5 (rewritten), 7 (`hybrid-retrieval`) and 8 (`reranking`), plus the Phase 4 process-log entry.

## Data state (Neon)

- Still two documents: `build-plan.md` (17 recursive chunks, active) and `pgvector-notes.pdf` (1 chunk). Both now have local vectors as well as Gemini ones.
- `build-plan.md` also has an **inactive semantic set** (25 chunks, threshold 0.4) saved while testing. Keep it for arena comparisons or delete it in the lab.
- Two `ingest_usage` rows from that test (one for the semantic set's Gemini embedding).
- Upstash: rerank cache entries and `rerank:calls:2026-10` = 6 (by this app's own count).

## Environment facts (new or changed)

- **Transformers.js** pulls in onnxruntime-node (~290 MB) and onnxruntime-web (~150 MB). `pnpm-workspace.yaml` sets `onnxruntime-node: false` and `protobufjs: false` under `allowBuilds`: the CPU binaries ship in the package, and the script only downloads CUDA add-ons. Install with `--store-dir /home/jd/work/.pnpm-store` as before.
- **Model files** are downloaded from Hugging Face on first use into `.cache/transformers/` (git-ignored; 109 MB, because both the fp32 and the q8 files were probed). On Vercel the code uses `/tmp/transformers`. A cold first load took about a minute per file; a warm load takes 177 ms.
- **Disk:** 1.8 GB free on `/home/jd/work` after this phase.
- **Another session's `next dev` may be running in this folder** (it was, on 3124). Next 16 allows only one dev server per folder and won't start a second one, so use the existing one at `http://localhost:3124` rather than `preview_start`. To format while it runs, pipe one file at a time through `pnpm exec prettier --stdin-filepath <f> < <f>` and write the result back; `prettier --check` is fine.
- `COHERE_API_KEY` is set in `.env`.

## Verified API facts (probed live, 31 Oct 2026)

- **Cohere Rerank:** `POST https://api.cohere.com/v2/rerank`, `Authorization: Bearer`, model `rerank-v5.0-fast`. It returns `results: [{ index, relevance_score }]` and `meta.billed_units.input_tokens` (41 for a tiny call, about 6,900–7,000 for 20 chunks of ~350 tokens). Headers include `x-trial-endpoint-call-limit: 10`, `x-trial-endpoint-call-remaining` and `x-endpoint-monthly-call-limit: 1000`, but nothing about the month's remaining calls. Price is $0.02 per 1M tokens (Fast) and $0.05 (Pro), from the Rerank 5 launch post; the pricing page only has a "search unit" FAQ and Model Vault prices. Latency is 1.1–1.6 s per call. `max_tokens_per_doc` defaults to 4,096.
- **Transformers.js 4.3.2:** vectors from mean pooling with `normalize: true` are unit length. `pipeline()` truncates at 512 tokens silently: a text and the same text with a different ending past that point scored 0.9998. fp32 embeds 64 sentences in 73 ms, q8 in 42 ms.
- **Postgres FTS:** `plainto_tsquery` (and `websearch_to_tsquery`) AND every word, so natural questions matched 0 chunks; OR works. Hyphenated identifiers split oddly (`llama-3.1-8b-instant` → `'llama' & '-3.1' & '-8' & 'b-instant' & 'b' & 'instant'`). At 18 rows the planner uses a sequential scan (0.08 ms), not GIN.
- **all-MiniLM-L6-v2 on the build plan:** neighbour similarity between three-sentence windows has median 0.76 and p10 0.50. Below a threshold of 0.3 only the size cap cuts; 0.5 gives 46 chunks; 0.4 gives 25. Semantic chunking takes about 3.3 s for 416 windows without the memo.

## Gotchas that cost time

- **MDX parses `{...}` even inside inline code containing escaped backticks.** A process-log line with a nested template literal broke every lesson with a 500 (acorn "Could not parse expression"). Keep code with `${}` and backticks in fenced blocks, or reword it.
- **`pnpm test` hides `console.log` from passing tests.** For a throwaway live probe written as a test, run `node --env-file=.env node_modules/vitest/vitest.mjs run --disableConsoleIntercept <file>`, and delete the file afterwards.
- **A shell chain like `pnpm exec tsc … | tail` swallows tsc's exit code.** One commit went in with a type error and was amended. Check with `pnpm typecheck >/dev/null && echo ok`.
- **Neon's tagged-template client can't nest SQL fragments.** Use a `CASE` on a parameter, or write separate queries (as `vector.ts` does for the two embedding columns).
- **React Compiler lint** rejects `setState` called synchronously in an effect, including through a `useCallback` that sets state. Set state inside the fetch's `.then` instead (see `chunking-lab.tsx`).
- **Client components must not import `lib/retrieval/index.ts`**, which pulls in the database and Transformers.js. Use `lib/retrieval/methods.ts`, or `import type`.
- Still true: check `tabs_context` for "pane is hidden" before debugging a page stuck on its Suspense fallback; `mcp__ccd_view__show_pane` with `preview` fixes it.

## Known open items (not bugs to fix unasked)

- **Local embeddings on Vercel are untested.** onnxruntime-node alone exceeds the 250 MB function limit. If the build fails or the size is exceeded, options are excluding it via `outputFileTracingExcludes`, or making the local option dev-only. The code already degrades: uploads skip local vectors, and the arena's local option would error.
- The corpus is thin (two documents). Jd planned to upload more; Phase 5's eval set needs them too.
- The prompt inspector's raw re-runs still record their chunks with `method: "vector"`, whatever the original run used.
- `/api/lab/chunk` and `/api/retrieve` without rerank are public, like chat. Previews only use local CPU, but a large document makes semantic chunking slow.
- The memo for local vectors is per process and lost on restart; the first semantic run per document takes ~3 s.
- The arena doesn't save runs; only chat writes to `runs`.
- Earlier open items from the Phase 3 handoff still stand (ledger quota axis unchecked visually, unwritten lessons return 200, OpenRouter not wired up, debugger replays without retrieval).

## Phase 5 scope (from the build plan)

- Draft 25 question-and-answer pairs from Jd's documents (`eval_items`: question, expected answer, `source_text`); Jd reviews and fixes them.
- A runner for hit rate@k and MRR (no LLM needed; a retrieved chunk is a hit if it contains most of the item's `source_text`, so it survives re-chunking), and LLM-as-judge for faithfulness and answer relevance with Gemini 3.8 Flash (fill in its free limits in `lib/config.ts` first).
- `/evals`: the eval set, a Run button, a table of past `eval_runs`, per-question drill-down with the judge's reasoning, and a Compare view of two runs.
- Runs are slow on purpose (`limits.evalDelayMs`, one question at a time).
- Lesson 10, plus a Phase 5 process-log entry.
- **Done when:** there's a baseline score and one setting change that measurably improves it. Phase 4 gives natural candidates: vector vs hybrid, rerank on or off, recursive vs semantic chunk sets.

Things to ask Jd before starting: have more documents been uploaded? Should eval runs choose the chunk set (via `chunkSetIds`) and the retrieval method as config? Should the judge's calls count towards the ledger (a run per judgement, or a separate table)? Should Gemini 3.8 Flash's free limits be checked in AI Studio first?

## How Jd likes to work

- One phase at a time. At "Done when", stop, summarise what was built and what to test, and wait.
- Ask clarifying questions in one batch before starting, and propose a task list.
- Probe live APIs (tiny calls) before trusting docs, and record surprises in the process log.
- Small Conventional Commits on a phase branch with the Co-Authored-By trailer; push only when asked.
- Avoid subagents (the web-fetch helper for reading docs is fine). Hand-rolled first: no AI SDK or LangChain before Phase 6.
- Each phase writes its lessons (template: idea, how it works, in this app, try it, what you should see, interview angle, go deeper) using real numbers from the app, plus a process-log entry.
