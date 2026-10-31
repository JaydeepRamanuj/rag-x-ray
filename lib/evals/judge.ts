import type { ChatMessage } from "@/lib/llm/types";

/**
 * LLM-as-a-judge. Several answers are graded in one call because the judge
 * model's free tier allows 20 requests a day: 25 questions one at a time
 * wouldn't fit a single run.
 *
 * Batching has a cost: the judge may let one answer colour its view of the
 * next. Each case carries its own sources and the rubric asks for a
 * judgement per case, which keeps the cases apart in practice.
 */
export const JUDGE_SYSTEM_PROMPT = `You grade answers from a retrieval-augmented question-answering system.

Each case has a question, the numbered sources the system retrieved, and the system's answer. Grade every case on its own, using only that case's sources.

Faithfulness (1-5): are the answer's claims supported by its sources?
5 = every claim is supported by the sources
4 = nearly all supported; one minor detail is not
3 = a mix of supported and unsupported claims
2 = mostly unsupported or contradicts the sources
1 = ignores or contradicts the sources entirely
An answer that only says the sources don't contain the answer makes no claims, so it scores 5.

Relevance (1-5): does the answer address the question that was asked?
5 = directly and completely answers it
4 = answers it with small gaps or some padding
3 = partly answers it
2 = mostly off-topic, or only says it can't answer
1 = doesn't address the question

Write your reasoning (one or two sentences) before the scores, and judge correctness only against the sources, not your own knowledge.

Reply with JSON only, in this shape:
{"results": [{"id": "<case id>", "reasoning": "...", "faithfulness": <1-5>, "relevance": <1-5>}]}
Include exactly one result for every case id.`;

export type JudgeCase = {
  id: string;
  question: string;
  sources: string;
  answer: string;
};

export function buildJudgeMessages(cases: JudgeCase[]): ChatMessage[] {
  const body = cases
    .map(
      (c) =>
        `=== Case ${c.id} ===\nQuestion: ${c.question}\n\nSources:\n${c.sources}\n\nAnswer:\n${c.answer}`,
    )
    .join("\n\n");
  return [
    { role: "system", content: JUDGE_SYSTEM_PROMPT },
    { role: "user", content: body },
  ];
}

export type Verdict = { reasoning: string; faithfulness: number | null; relevance: number | null };

function score(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  return rounded >= 1 && rounded <= 5 ? rounded : null;
}

/**
 * Parses the judge's reply into a verdict per case id. JSON mode makes the
 * reply valid JSON, but a model can still wrap it in a code fence, skip a
 * case or answer with a bare array, so each of those is tolerated; a case
 * with no usable verdict is simply missing from the map.
 */
export function parseJudgeReply(text: string, ids: string[]): Map<string, Verdict> {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return new Map();
  }
  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { results?: unknown })?.results)
      ? (parsed as { results: unknown[] }).results
      : [];

  const wanted = new Set(ids);
  const out = new Map<string, Verdict>();
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const id = String(e.id ?? "");
    if (!wanted.has(id) || out.has(id)) continue;
    out.set(id, {
      reasoning: typeof e.reasoning === "string" ? e.reasoning : "",
      faithfulness: score(e.faithfulness),
      relevance: score(e.relevance),
    });
  }
  return out;
}
