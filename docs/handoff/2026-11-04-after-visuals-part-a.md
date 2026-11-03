# Handoff: after Visuals Part A (4 Nov 2026)

Next up is **Part B (animated pipeline walkthrough)** of the [visual learning plan](../visual-learning-plan.md). Read that plan first. The [Phase 6 handoff](./2026-11-01-after-phase-6.md) still holds for servers, API facts and gotchas; this file replaces the [Part A handoff](./2026-11-04-visuals-part-a.md).

## Where things stand

| Branch              | State                                                                      |
| ------------------- | -------------------------------------------------------------------------- |
| `phase-6-polish`    | Pushed to `origin`, not merged                                             |
| `visuals-a-figures` | Part A, on top of `phase-6-polish`. **Local only, not pushed**, awaiting Jd's review |

Push or merge only when Jd says so. Checks on `visuals-a-figures`: `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm test` (133 tests) and `pnpm build` all pass.

## Jd's decisions this session

- **Figures are diagrams we draw, not generated images.** Generated images and their briefs are on hold; `<Figure>` already takes a `src` for when that's decided.
- **Figures sit beside the ASCII sketches, which stay.**
- **Cover every lesson with a sketch**, not only the plan's first seven candidates. Lesson 12 (Libraries vs hand-rolled) was not on the list and has no figure yet.

## What Part A added

- `components/learn/figure.tsx`: `<Figure alt caption>` with either `src` + `width` + `height` (through `next/image`, lazy) or children (a diagram). Click or Enter opens a native `<dialog>` full size; Esc or any click closes it, and focus returns to the figure. The full-size copy renders only while open. On a phone the dialog keeps the diagram at 720px and scrolls sideways.
- `components/learn/diagrams/kit.tsx`: `Svg`, `Box`, `Arrow`, `Text`, `columns()`, and `ink(tone)` / `wash(tone, %)` over the `--series-1…8` tokens. Diagrams are 720 units wide (the lesson column), so 13 units of text is 13px on a desktop.
- 13 diagrams in `components/learn/diagrams/`, exported from `index.ts` and spread into `mdx-components.tsx`. The plan's Part A section has the table of which lesson has which.
- Numbers come from `lib/config.ts` where it has them (`chunkSize`, `chunkOverlap`, `rrfK`, `candidates`, `topK`, prices, `retry.maxAttempts`), otherwise from the lesson the figure sits in.
- `content/learn/process-log.mdx`: reworded one line that broke the glossary test (see Gotchas).

Commits: `b500dba` fix, `c8b9b68` components, `a6cf1ec` lessons, `25102f5` plan update.

## Starting Part B

1. Ask Jd whether to branch from `visuals-a-figures` (suggested `visuals-b-walkthrough`) or keep stacking on it.
2. **Settle one conflict with Jd first:** the plan says the walkthrough _replaces_ the ASCII diagrams in Start here and Full pipeline, but Part A's decision was to keep the ASCII sketches. Ask whether Part B replaces them, sits beside them, or replaces Part A's `TwoFlowsDiagram` in Start here. (Full pipeline's Part A figure is a timing chart, a different view, so it can likely stay.)
3. Pick the fixed example. Lesson 13's trace is the natural one: the question "What does the HNSW index do, and why did Postgres ignore it here?", run `0f59bf82-0072-4b8a-82e3-446c8f1d02aa` (cold) and `f3a249c3-…` (cached), with real timings already in `content/learn/full-pipeline.mdx`. Read that run's top-5 chunks and scores from Neon (`run_chunks`) once and store them as a small data file, so the animation's numbers are true. Check the chunks still exist in `content/corpus/`.
4. Build `<PipelineWalkthrough>` on the Part A kit so it matches the figures. Play / Pause / Step / Reset; Space and arrow keys; static diagram under `prefers-reduced-motion`; works at phone width. Each stage gets one plain sentence and links to its lesson and tool.
5. Stop at Part B's "Done when" for review.

## Useful facts

- **Diagram ids:** the kit draws arrowheads as polygons, not `<marker>`s, so no SVG ids exist. Keep it that way: a figure can be on the page twice (inline and in the dialog), and the inline copy sits inside a `<button>`, so `Picture` uses a `<span>`, not a `<div>`.
- **Lint rule `react-hooks/immutability`** rejects reassigning a variable inside `.map()` during render (e.g. a running `x += w`). Compute layouts at module scope or with prefix sums.
- **Server components:** diagrams are server components passed as children into the client `Figure`. A walkthrough with state will be a client component; keep its data import client-safe (`lib/config.ts` is fine).
- **`<Term id="…">` in prose counts as a term:** `content/glossary.test.ts` regex-scans every `.tsx`/`.mdx` under `app`, `components` and `content`. Don't write that literal syntax in docs or comments there.

## Browser pane quirks (this session)

- After `navigate`, the first `javascript_tool` call in the same batch can run before the page settles, and `window.scrollTo` gets reset. Scrolling with `computer` `scroll` was reliable.
- Screenshots sometimes didn't show an open `<dialog>`, though `dialog.open` was `true`; check state with JS too.
- The pane stopped drawing once (screenshots timed out) when the app window was likely behind another window. DOM checks via `javascript_tool` still worked.
- Stop the dev server before `pnpm format` (auto-memory note); this session did, with no reload loop.

## How Jd likes to work

Unchanged: one part at a time and stop at "Done when"; questions in one batch with a proposed task list; small Conventional Commits with the Co-Authored-By trailer; push only when asked; avoid subagents; real numbers from the app.
