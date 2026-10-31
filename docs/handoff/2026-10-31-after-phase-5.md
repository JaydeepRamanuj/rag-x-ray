# Handoff: after Phase 5 (31 Oct 2026)

Read this together with [the build plan](../RAG%20X-Ray%20—%20Build%20Plan.md), which is the spec, and [the process log](../../content/learn/process-log.mdx). The [Phase 4 handoff](./2026-10-31-after-phase-4.md) still holds for everything this file doesn't change.

## Where things stand

| Phase | Status | Branch |
| --- | --- | --- |
| 0 Foundation | Done, merged to `main`, deployed | `phase-0-foundation` (merged) |
| 1–3 | Done, pushed, **not merged** | stacked: `phase-1-llm-streaming` → `phase-2-ingestion-rag` → `phase-3-inspector-ledger` |
| 4 Chunking lab and retrieval arena | Done, **not pushed**, awaiting Jd's review | `phase-4-chunking-retrieval` |
| 5 Eval mode | Done, **not pushed**, awaiting Jd's review | `phase-5-evals` (on top of phase 4) |
| 6 Embedding explorer, library comparison, polish | **Next.** Don't start until Jd says go | create `phase-6-polish` from `phase-5-evals` |

Merging: once Jd approves, fast-forward `main` to `phase-5-evals`. Only push or merge when Jd says so.

Checks on `phase-5-evals`: `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm test` (124 tests) pass. **`pnpm build` was not run**: a `next start` server on port 3000 serves this folder's `.next`, and a build would replace its files under it. Run it once that server is stopped.

## What Phase 5 added

- `content/corpus/*.md`: five learning documents (LLM generation, history, RAG, LangChain/LangGraph and frameworks, modern AI pipeline). Uploaded through `/api/ingest`; 46 recursive chunks with Gemini and local vectors.
- `content/evals/eval-set.json`: 25 drafted items (question, expected answer, source passage), imported with **Import the drafted set** on `/evals` or `POST /api/evals/items {"import":"draft"}`. Jd still needs to review them; edit on the page.
- `drizzle/0006_eval_runs_status.sql` (**applied**): `eval_items.ordinal`; `eval_runs.status`, `error`, `cost_usd`, `finished_at`. `eval_runs.results` is `{ items: ItemResult[], judgeCalls: JudgeCall[] }`.
- `lib/evals/`: `metrics.ts` (trigram source matching, hit rate, MRR, compare), `judge.ts` (rubric, batch prompt, tolerant parser), `plan.ts` (pacing and resume, client-safe), `types.ts` (zod run config, client-safe), `runner.ts` (server: start, item, judge, finish, reopen).
- `lib/db/evals.ts`; `lib/db/ledger.ts` `dailyUsage()` now also returns `evals` (answer and judge calls per day per model).
- `ChatParams.json` → Gemini `responseMimeType: "application/json"`, Groq `response_format: json_object`.
- API: `GET/POST /api/evals/items`, `PATCH/DELETE /api/evals/items/[id]`, `GET/POST /api/evals/runs`, `GET/POST/DELETE /api/evals/runs/[id]` with `action: item | judge | finish | reopen`. Writes need `APP_PASSWORD`.
- UI: `/evals` (`components/evals/`), eval requests stacked in the ledger's daily chart. Lesson 10 and the Phase 5 process-log entry.
- `lib/config.ts`: Gemini 3.8 Flash free limits (5 RPM, 250k TPM, 20 RPD, from AI Studio), `limits.judgeBatchSize = 5`.

## Data state (Neon)

- Seven documents: the two from before plus the five corpus files. The corpus files on disk were later reformatted by Prettier (table alignment only), so re-uploading one replaces the stored copy.
- 25 `eval_items`; eval runs: retrieval-only vector, keyword, hybrid, hybrid + rerank, and two full runs (vector baseline, hybrid + rerank).

## Results (the "Done when")

| Run | Hit rate | MRR | Faithfulness | Relevance |
| --- | --- | --- | --- | --- |
| Vector, retrieval only | 88% | 0.83 | | |
| Keyword | 92% | 0.77 | | |
| Hybrid | 92% | 0.88 | | |
| Hybrid + rerank | 100% | 0.98 | | |
| Vector, full (baseline) | 88% | 0.83 | 5.0 | 4.88 |
| Hybrid + rerank, full | 100% | 0.98 | 5.0 (5 of 25 judged) | 5.0 (5 of 25 judged) |

Retrieval improvement (the "Done when"): hybrid + rerank over the vector baseline, hit rate 88% → 100%, MRR 0.83 → 0.98: 3 questions fixed (HyDE, the RRF merge, the BM25 stand-in), 2 ranked higher, none worse. The judge's daily quota ran out during the second full run; press **Complete (4)** on it after midnight Pacific to judge the other 20 answers, then compare again.

## Gotchas

- **Gemini 3.8 Flash as judge is slow and sometimes 503s** ("high demand"): 32–187 s per batch call. The step route allows 300 s; the page retries once; **Complete** reopens a finished run to judge missing answers. Flash-Lite can be picked as the judge instead.
- **Don't navigate the `/evals` tab while a run is going**: the browser drives the run. Use another tab. A closed tab leaves a resumable run.
- A dev server compiled mid-edit can serve a half-built module ("Cannot convert undefined or null to object" from Drizzle's `orderSelectedFields`). Reload after the compile settles before debugging.
- Each full run uses 5 of the judge's 20 daily requests, and retried 503s seem to count too: the quota ran out after six successful judge calls. The page stops judging on a daily-quota 429.

## Known open items

- Faithfulness was 5/5 on every judged answer; the judge may be too lenient to discriminate. A stricter rubric or claim-by-claim checking (RAGAS-style) is a possible follow-up.
- Query embeddings for evals aren't counted in eval totals (they're tiny and cached).
- Earlier open items from the Phase 4 handoff still stand.

## Environment facts

- Two Next servers point at this folder: **`next dev` on 3124** (another session's; use it rather than `preview_start`, Next 16 allows one dev server per folder) and an old **`next start` on 3000** that still shows the Phase 0 placeholder pages. Ask Jd before stopping either.
- To format while the dev server runs, pipe one file at a time through `pnpm exec prettier --stdin-filepath <f> < <f>` and write the result back; `pnpm format:check` is fine.
- Disk: about 1.8 GB free on `/home/jd/work`. Install with `--store-dir /home/jd/work/.pnpm-store`.
- Today's (31 Oct) Gemini 3.8 Flash quota is used up; it resets at midnight Pacific.

## Phase 6 scope (from the build plan)

- **Embedding explorer** at `/lab/embeddings` (currently a placeholder): every chunk as a dot in 2D, coloured by document; a typed query appears as a star linked to its 5 nearest chunks. Controls: Gemini vs local model, 768 vs 256 dimensions, UMAP vs PCA (`umap-js` in the browser, PCA as fallback). A similarity playground: two sentences and their cosine similarity (synonyms, negation, languages).
- **Library comparison:** rewrite `/api/chat` with the Vercel AI SDK on a separate route and compare the code side by side. This is the first phase where the AI SDK is allowed.
- **Lessons 12** (libraries vs hand-rolled) and **13** (the full pipeline, one request traced end to end with real timings), plus the Phase 6 entry in lesson 14 (process log).
- **README** with an architecture diagram and screenshots.
- **Done when:** the Learn page is complete and the app is portfolio-ready.

Things to ask Jd before starting:

- Have phases 4 and 5 been reviewed? Should `main` be fast-forwarded and pushed first?
- The 256-dimension Gemini option means new vectors (Matryoshka truncation of the stored 768, or a re-embed). Truncate in the browser, or store a column?
- Which AI SDK version and provider packages (check current docs), and should the AI SDK route also be recorded in `runs` and the ledger?
- Should the README screenshots come from the deployed app, which needs Vercel and the local-embeddings size question settled (see the Phase 4 handoff)?
- Re-judge the second full eval run (**Complete (4)** on `/evals`) once the quota resets?

## How Jd likes to work

- One phase at a time. At "Done when", stop, summarise what was built and what to test, and wait.
- Ask clarifying questions in one batch before starting, and propose a task list.
- Probe live APIs with tiny calls before trusting docs, and record surprises in the process log.
- Small Conventional Commits on the phase branch with the Co-Authored-By trailer; push only when asked.
- Avoid subagents (the web-fetch helper for reading docs is fine).
- Each phase writes its lessons (idea, how it works, in this app, try it, what you should see, interview angle, go deeper) using real numbers from the app, plus a process-log entry.
