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

export const NO_SOURCES = "(No sources were found for this question.)";

/** The label after a source's number, e.g. "notes.md (chunk 3)". */
export function sourceLabel(s: Pick<RetrievedChunk, "title" | "ordinal">): string {
  return `${s.title} (chunk ${s.ordinal + 1})`;
}

/** Numbered source blocks. Numbers come from position, so removing one renumbers the rest. */
export function formatSourceBlocks(blocks: { label: string; content: string }[]): string {
  if (blocks.length === 0) return NO_SOURCES;
  return blocks.map((b, i) => `[${i + 1}] ${b.label}\n${b.content}`).join("\n\n");
}

export function formatSources(sources: RetrievedChunk[]): string {
  return formatSourceBlocks(sources.map((s) => ({ label: sourceLabel(s), content: s.content })));
}

export const SOURCES_HEADER = "Sources:\n\n";
export const QUESTION_PREFIX = "\n\nQuestion: ";

/** The last user message of a RAG prompt: sources first, then the question. */
export function ragUserMessage(sourcesText: string, question: string): string {
  return `${SOURCES_HEADER}${sourcesText}${QUESTION_PREFIX}${question}`;
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
  /** The prompt inspector can swap the rules out to see what they change. */
  systemPrompt?: string;
}): ChatMessage[] {
  return [
    { role: "system", content: input.systemPrompt ?? RAG_SYSTEM_PROMPT },
    ...input.history.filter((m) => m.role !== "system"),
    { role: "user", content: ragUserMessage(formatSources(input.sources), input.question) },
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
