# Handoff: after Visuals Part B, FAQs drafted (4 Nov 2026)

This replaces the [after Part A handoff](./2026-11-04-after-visuals-part-a.md). The [Phase 6 handoff](./2026-11-01-after-phase-6.md) still holds for servers, API facts and gotchas.

## Where things stand

| Branch                  | State                                                                       |
| ----------------------- | --------------------------------------------------------------------------- |
| `phase-6-polish`        | Pushed to `origin`, not merged                                              |
| `visuals-a-figures`     | Part A, local only, awaiting Jd's review                                    |
| `visuals-b-walkthrough` | Part B, on top of `visuals-a-figures`. Local only, awaiting Jd's review     |

Push or merge only when Jd says so. On `visuals-b-walkthrough`, lint, typecheck, format check, tests (133) and build all pass.

## Part B (done, awaiting review)

`<PipelineWalkthrough>` (`components/learn/pipeline-walkthrough.tsx`) is in Start here (replacing `TwoFlowsDiagram`, now deleted) and Full pipeline (under the ASCII sketch). The data is in `content/learn/example-run.ts`. The plan's Part B section records the decisions. Not verified in a browser: `prefers-reduced-motion` (the pane can't emulate it).

## Next: lesson FAQs

Jd wants an FAQ section under every lesson. The draft list (92 questions, each with a one-line answer sketch) is in [`docs/lesson-faqs-draft.md`](../lesson-faqs-draft.md). **Jd hasn't reviewed it yet.**

1. Ask Jd for additions, cuts or rewording, and these two open questions (also at the end of the draft):
   - Placement: after Interview angle, before Go deeper?
   - Format: collapsible, one `<details>` per question?
2. Settle the 7 answers marked **(check)** before writing them.
3. Write final answers (2–4 sentences, linking the lesson, tool or code they rely on), probably as an `<Faq>` component registered in `mdx-components.tsx`.
4. Ask whether to branch from `visuals-b-walkthrough` or elsewhere.

Facts already checked in the code while drafting:

- Scanned PDFs are rejected: there's no OCR (`app/api/ingest/route.ts`).
- Chat retrieves for the latest user question only; there's no query rewriting (`app/api/chat/route.ts`).
- When rerank fails, the arena shows the error, but chat's `retrieveForChat()` throws, with no fallback to hybrid's order. This may be worth fixing; ask Jd.
- Only the reranked top 5 are saved in `run_chunks` for a run.
- The database URL is in `.env`, not `.env.local`.

## How Jd likes to work

Unchanged: one part at a time, stopping at "Done when"; questions asked in one batch with a proposed task list; small Conventional Commits with the Co-Authored-By trailer; push only when asked; avoid subagents; real numbers from the app.
