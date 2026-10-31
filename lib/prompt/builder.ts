import type { ChatMessage } from "@/lib/llm/types";
import type { RetrievedChunk } from "@/lib/retrieval/vector";

/**
 * Grounding instructions. Each line closes a specific failure mode:
 * answering from general knowledge, inventing citations, and guessing when
 * the sources don't cover the question.
 */
export const RAG_SYSTEM_PROMPT = [
  "You answer questions using only the numbered sources provided with each question.",
  "Cite every claim with the number of the source it came from, like [1] or [2][3].",
  "Only cite numbers that appear in the sources. Never invent a source.",
  "If the sources don't contain the answer, say so plainly instead of guessing.",
  "Be concise.",
].join("\n");

export function formatSources(sources: RetrievedChunk[]): string {
  if (sources.length === 0) return "(No sources were found for this question.)";
  return sources
    .map((s, i) => `[${i + 1}] ${s.title} (chunk ${s.ordinal + 1})\n${s.content}`)
    .join("\n\n");
}

/**
 * The final prompt is: system rules, then earlier turns as plain Q&A, then
 * the sources together with the new question.
 *
 * Sources go in the last user message, not the system prompt, because they
 * belong to this question only. Earlier turns are sent without their
 * sources, so the prompt doesn't keep growing by top-k chunks every turn.
 */
export function buildRagMessages(input: {
  history: ChatMessage[];
  question: string;
  sources: RetrievedChunk[];
}): ChatMessage[] {
  return [
    { role: "system", content: RAG_SYSTEM_PROMPT },
    ...input.history.filter((m) => m.role !== "system"),
    {
      role: "user",
      content: `Sources:\n\n${formatSources(input.sources)}\n\nQuestion: ${input.question}`,
    },
  ];
}

/** Which source numbers an answer actually cited, e.g. "[1][3]" → [1, 3]. */
export function citedNumbers(answer: string, sourceCount: number): number[] {
  const found = new Set<number>();
  for (const match of answer.matchAll(/\[(\d+)\]/g)) {
    const n = Number(match[1]);
    if (n >= 1 && n <= sourceCount) found.add(n);
  }
  return [...found].sort((a, b) => a - b);
}
