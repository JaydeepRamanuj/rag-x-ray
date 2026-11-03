# Visual learning plan

The lessons explain flows with text and ASCII sketches. This plan adds pictures, animations and simulations so each idea can also be _seen_. It runs in four parts, done in order, one at a time, each stopping at its "Done when" for Jd's review.

| Part | What                              | Status                     |
| ---- | --------------------------------- | -------------------------- |
| A    | Static figures in lessons         | Built, awaiting review     |
| B    | Animated pipeline walkthrough     | Built, awaiting review     |
| C    | Simulations inside each lesson    | Deferred (kept for later)  |
| D    | Replay a real run as an animation | Deferred (kept for later)  |

These parts are named with letters so they don't get mixed up with the build plan's Phases 0–6.

## Ground rules (all parts)

- **Show what this app does.** Labels, stage names and numbers come from the code in `lib/` and the lessons (e.g. 400-token chunks with 40 tokens of overlap), not from generic RAG diagrams. If a visual shows a stage the app doesn't run, it says so.
- **Learner in control.** Anything that moves can be paused and stepped. Nothing autoplays forever.
- **Respect `prefers-reduced-motion`**: show a static version instead.
- **No new dependencies** unless one clearly earns its place. SVG, CSS and React state are enough for A and B. `tw-animate-css` is already installed.
- **Light theme first.** The app has no dark mode toggle (see the Phase 6 handoff), so visuals are designed for the light pages.
- **Lessons stay MDX.** Visuals are React components registered in `mdx-components.tsx`, like `<Term>`.

## A. Static figures in lessons

Add pictures to the lessons. **Decided 4 Nov 2026:** the figures are diagrams we draw ourselves as inline SVG, not generated images. Their text is real text (searchable, spelled right, in the page's font), their colours are the app's `--series-*` tokens, and their numbers come from `lib/config.ts` or the lesson they sit in. Generated images are on hold; `<Figure>` already takes a `src` for when we decide.

The two images in [`reference-images/`](./reference-images/README.md) are **reference only**: they show the style and content Jd liked. They are not used in the app (one has a misspelled title, the other is too small to read).

1. **`<Figure>` component** (`components/learn/figure.tsx`). `alt` (required), `caption`, and either `src` + `width` + `height` (an image in `public/learn/`, through `next/image`, lazy-loaded) or children (a diagram). Click or Enter opens it full size in a native `<dialog>`; Esc or any click closes it. `next/image` does resolve through the lessons' dynamic MDX import in dev (checked with a placeholder), so no `<img>` fallback was needed.
2. **Diagrams** in `components/learn/diagrams/`, drawn with a small kit (`kit.tsx`: boxes, arrows, text) at 720 units wide, the lesson column's width, so text is page-sized on a desktop. On a phone the full-size view keeps 720px and scrolls sideways. Each figure sits next to the lesson's ASCII sketch, which stays.

   | Lesson               | Diagram                  | Shows                                                         |
   | -------------------- | ------------------------ | ------------------------------------------------------------- |
   | 0 Start here         | `TwoFlowsDiagram` (retired in Part B) | ingestion and the question flow, meeting at the vector store  |
   | 1 LLM API call       | `ApiCallDiagram`         | message list in, one message and usage out; history re-sent   |
   | 2 Tokens             | `TokenPillsDiagram`      | the example sentence as 6 tokens; input vs output price       |
   | 3 Streaming          | `StreamHopsDiagram`      | the two SSE hops as a sequence diagram, with TTFT             |
   | 4 Embeddings         | `EmbeddingAnglesDiagram` | small angle = similar, wide angle = unrelated (a 2D sketch)   |
   | 5 Chunking           | `ChunkOverlapDiagram`    | fixed chunks at 0–400, 360–760, 720–1120 with 40-token overlap |
   | 6 Vector databases   | `ExactVsHnswDiagram`     | exact search over 18 rows vs HNSW's layered greedy search     |
   | 7 Hybrid retrieval   | `RrfDiagram`             | two ranked lists fused by RRF, k = 60, scores computed live   |
   | 8 Reranking          | `RerankFunnelDiagram`    | 64 → 20 → 5, and bi-encoder vs cross-encoder                  |
   | 9 Prompt construction | `PromptBudgetDiagram`   | one real prompt's 2,260 tokens to scale; sources are 95%      |
   | 10 Evaluating RAG    | `HitRankDiagram`         | first-hit ranks 1, 2, miss, 4 → hit rate 0.75, MRR 0.44       |
   | 11 Caching and cost  | `CostLeversDiagram`      | the three levers and the stage each acts on                   |
   | 13 Full pipeline     | `PipelineTimingDiagram`  | the cold and cached runs' stage timings, to scale             |

   Lesson 12 (Libraries vs hand-rolled) has no figure yet.
3. **If generated images come back later:** write briefs (real stage names and numbers, no title or long sentences in the image, every label listed so it can be checked), then check each image's spelling, accuracy and resolution before converting it to `.webp` in `public/learn/`.

**Done when:** `<Figure>` works in a lesson (including full-size view and keyboard close), at least Start here and Full pipeline have a checked figure, and lint, typecheck, format check, tests and build pass. (The briefs step is on hold with the generated images.)

## B. Animated pipeline walkthrough

A `<PipelineWalkthrough>` component: an SVG diagram of the app's pipeline with **Play / Pause / Step / Reset**. A sample question moves through each stage (embed the question → search the vector store → top-5 chunks → build the prompt → model → answer streams back token by token). The current stage lights up, with one plain sentence about what happens there and a link to that stage's lesson and tool.

- Uses a fixed example: a real question and real chunk excerpts from `content/corpus/`, with real scores taken once from the app, so the numbers are true.
- Shows both flows: indexing (document → chunks → vectors → store) and question → answer, joined at the vector store.
- Keyboard: Space plays or pauses, arrow keys step.
- Goes into Start here and Full pipeline, replacing their ASCII diagrams.

**Built 4 Nov 2026** (`components/learn/pipeline-walkthrough.tsx`, branch `visuals-b-walkthrough`). Decided with Jd:

- **ASCII sketches stay** (as in Part A). In Start here the walkthrough replaces Part A's `TwoFlowsDiagram`, which showed the same two flows and is deleted. In Full pipeline it sits under the ASCII sketch, and `PipelineTimingDiagram` stays further down.
- **The real stages**, not the plan's simplified list: document → chunk → embed → vector store, then question → embed → search (vector ∥ keyword, RRF) → rerank 20 → 5 → prompt → model → answer. 11 steps.
- **Cold-run timings as labels**, played at an even pace (2.6 s a stage, the answer at 45 ms a word), not in real time. Cold vs cached is left to the timing chart.
- **Data** in `content/learn/example-run.ts`: run `0f59bf82…`, read once from Neon on 4 Nov 2026. Only the reranked top 5 are saved for a run, so the search step shows no per-candidate scores. Of those 5, only `retrieval-augmented-generation.md` is in `content/corpus/` (the others were uploaded through the app), so the indexing side follows that file: 3,467 tokens, 11 chunks.
- **Reduced motion:** no Play and no transitions, the answer appears whole; Step, Back and Reset still work. **Phone:** below `sm` the diagram (unreadable at that size) becomes a segment per stage; the stage panel is unchanged.

**Done when:** the walkthrough plays, pauses, steps and resets; shows a static diagram under reduced motion; works at phone width; is in both lessons; and the checks pass.

## C. Simulations inside each lesson (deferred)

Small interactive pieces that run the app's real code, so what the learner sees matches what the app does:

| Lesson             | Simulation                                                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Tokens             | Type a sentence and watch it split into coloured token pills, with a live count                                            |
| Chunking           | Size and overlap sliders re-cut a paragraph live, overlaps highlighted; switch between the four strategies                 |
| Embeddings         | Two arrows with a changing angle show cosine similarity; a typed sentence's dot lands near similar ones on a 2D map         |
| Retrieval / Hybrid | A search circle grows around the query until it holds the top 5; keyword and vector lists merge by reciprocal rank fusion |
| Reranking          | Result cards slide into their new order, each showing its score change                                                    |
| Streaming          | Answer tokens arrive one by one, with the raw server-sent events shown beside the text                                     |
| Caching and cost   | A meter that fills for a fresh request and stays nearly empty for a cached one                                             |

Start with Chunking and Embeddings, which gain the most from seeing things move.

## D. Replay a real run (deferred)

A **Replay** button on `/runs/[id]` that plays the Part B walkthrough with that run's real data: the chunks it found, their scores, the prompt it built, and the answer as it streamed. Reuses the Part B component. First check what a saved run contains (especially stage timings) and whether that's enough.
