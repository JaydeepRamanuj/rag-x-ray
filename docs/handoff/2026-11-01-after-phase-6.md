# Handoff: after Phase 6 (1 Nov 2026)

Read this together with [the build plan](../RAG%20X-Ray%20—%20Build%20Plan.md) and [the process log](../../content/learn/process-log.mdx). The [Phase 5](./2026-10-31-after-phase-5.md) and [Phase 4](./2026-10-31-after-phase-4.md) handoffs still hold where this file doesn't change them.

## Where things stand

| Phase                                              | Status                                     | Branch                                                                                      |
| -------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| 0 Foundation                                       | Done, merged to `main`, deployed           | `phase-0-foundation` (merged)                                                               |
| 1–3                                                | Done, pushed, **not merged**               | stacked: `phase-1-llm-streaming` → `phase-2-ingestion-rag` → `phase-3-inspector-ledger` |
| 4 Chunking lab and retrieval arena                 | Done, **pushed 1 Nov**, not merged         | `phase-4-chunking-retrieval`                                                                |
| 5 Eval mode                                        | Done, **pushed 1 Nov**, not merged         | `phase-5-evals`                                                                             |
| 6 Embedding explorer, library comparison, polish | Done, **not pushed**, awaiting Jd's review | `phase-6-polish` (on top of phase 5)                                                        |

All seven phases of the build plan are built. Merging: once Jd approves, fast-forward `main` to `phase-6-polish`. Only push or merge when Jd says so.

Checks on `phase-6-polish`: `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm test` (130 tests) and `pnpm build` pass.

## What Phase 6 added

- `lib/embeddings/vector-math.ts` (client-safe: cosine, Matryoshka `truncateVector()`, `nearest()`, `nearest2d()`), `lib/projection/pca.ts` (power iteration) and its tests.
- `lib/db/explorer.ts` and `app/api/embeddings/route.ts`: `GET ?model=gemini|local` returns every active chunk's vector; `POST { texts (1–2), model, task: query|similarity }` embeds. Public, like chat.
- `/lab/embeddings` (`components/embedding-explorer/`): UMAP (`umap-js` 1.4.0, seeded, refitted with the query) or PCA, 768/256/384 dims, legend click to highlight a document, hover cards, the "N of 5" check, a table view, and the similarity playground. Query params `?q=&model=&dims=&proj=`.
- `--series-1…8` colour tokens in `app/globals.css` (light under `:root`, dark under `.dark`).
- `app/api/chat-sdk/route.ts`: `ai` 7.0.159, `@ai-sdk/google` 4.0.109, `@ai-sdk/groq` 4.0.74. It's the same RAG chat (no raw mode, debugger or re-run options) and saves runs with `config.engine = "ai-sdk"`, `source: "sdk"`.
- `/lab/sdk` (`components/sdk-compare/`, `lib/compare/sources.ts`): code side by side with line counts, and a race. Prerendered with `'use cache'`; `next.config.ts` lists the files in `outputFileTracingIncludes`.
- Nav: **Library comparison** under Labs. `components/coming-soon.tsx`, `findNavItem()` and the nav `phase` field are gone (nothing used them once every page existed).
- Lessons 12 (`libraries-vs-hand-rolled`) and 13 (`full-pipeline`), an explorer section in Lesson 4, and the Phase 6 entry in the process log. All 14 lessons are written.
- `README.md` rewritten, with a Mermaid architecture diagram and `docs/screenshots/*.png` (1.4 MB, taken from `next start`).
- `package.json` `engines.node` is now `>=22` (the AI SDK v7 needs it).

## Verified API facts (probed 1 Nov 2026)

- **AI SDK v7:** `instructions` (not `system`), `stream` (not `fullStream`), `onEnd` (not `onFinish`), `createGoogle` (not `createGoogleGenerativeAI`). Text parts are `text-delta` with `.text` on `stream`, but `delta` on the UI message stream wire. `usage` is `{ inputTokens, inputTokenDetails: { noCacheTokens, cacheReadTokens }, outputTokens, outputTokenDetails: { textTokens, reasoningTokens }, totalTokens, raw }`. Usage is only in the final `finish` part (`totalUsage`). Response headers are at `(await result.finalStep).response.headers`. `createUIMessageStreamResponse` sets `x-vercel-ai-ui-message-stream: v1`. The default `onError` hides messages.
- **Google provider** reads `GOOGLE_GENERATIVE_AI_API_KEY` by default; the route passes `GEMINI_API_KEY`. Thinking: `providerOptions.google.thinkingConfig.thinkingLevel`. Groq: `providerOptions.groq.reasoningEffort`.
- **umap-js `transform()`** places new points poorly on this data (see the process log); refit instead.
- **Similarity floors:** Gemini (SEMANTIC_SIMILARITY) scores unrelated sentences ~0.71; MiniLM ~0.01.

## Data state

- No schema changes and no migrations this phase.
- New `runs` rows: SDK runs (`config.engine = "ai-sdk"`), races from `/lab/sdk`, the Lesson 13 trace runs (`0f59bf82-…` cold, `f3a249c3-…` cached) and one debugger replay. The README's prompt-inspector and debugger screenshots show run `0f59bf82-0072-4b8a-82e3-446c8f1d02aa`.
- New Upstash entries: query and similarity-pair embeddings, one rerank. Cohere calls this month went up by about 4.

## Gotchas

- **Two servers this session, both started by this session:** `next dev` on 3124 and `next start` on 3123 (`.claude/launch.json` `dev` and `prod`). Next 16 keeps dev output in `.next/dev`, so `pnpm build` no longer disturbs a running dev server, but it does replace the files under a running `next start`.
- **The app has no dark mode toggle.** The `.dark` tokens exist, but nothing sets the class and it doesn't follow `prefers-color-scheme`, so the explorer's dark palette is untested in the app.
- **Production without `APP_PASSWORD`** refuses rerank, eval runs and uploads with "uploads are disabled", which is misleading for the first two.
- **Headless screenshots:** don't use `--virtual-time-budget` (it freezes `performance.now()`). The screenshots came from a ~40-line Node script that starts `google-chrome --headless=new --remote-debugging-port`, navigates, waits, optionally clicks via `Runtime.evaluate`, and calls `Page.captureScreenshot`. It wasn't committed.

## Known open items

- **Vercel deployment is still the Phase 0 one.** Deploying phases 1–6 needs the local-embeddings size question settled (onnxruntime-node exceeds the 250 MB function limit; see the Phase 4 handoff). `/api/embeddings?model=local`, the playground's MiniLM score and semantic chunking all use the local model.
- The SDK route has no raw mode, so the streaming debugger's **Replay** of an SDK run goes through the hand-rolled `/api/chat`.
- Explorer and playground query embeddings aren't counted in the ledger (they're cached and tiny, like eval query embeddings).
- The explorer sends every vector to the browser (~610 KB at 64 chunks). Thousands of chunks would need sampling or server-side projection.
- The second full eval run still has 20 unjudged answers (**Complete (4)** on `/evals`); not done this phase, at Jd's choice.
- Earlier open items from the Phase 4 and 5 handoffs still stand (lenient judge, inspector re-runs recorded as `vector`, arena runs not saved).

## Stretch goals (from the build plan, not started)

Query rewriting with chat history, prompt caching on repeated context, tool calling (agentic retrieval), structured JSON answers validated by Zod.

## How Jd likes to work

Unchanged: one phase at a time and stop at "Done when"; questions in one batch with a proposed task list; probe live APIs before trusting docs; small Conventional Commits with the Co-Authored-By trailer; push only when asked; avoid subagents (the web-fetch helper is fine); lessons with real numbers.
