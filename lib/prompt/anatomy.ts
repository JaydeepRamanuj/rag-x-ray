import type { ChatMessage } from "@/lib/llm/types";

import {
  formatSourceBlocks,
  NO_SOURCES,
  QUESTION_PREFIX,
  ragUserMessage,
  SOURCES_HEADER,
} from "./builder";

/** One numbered source as it appeared in the prompt. */
export type SourceBlock = {
  n: number;
  label: string;
  content: string;
  /** Known when the run's chunks are still in the database. */
  chunkId?: string;
  score?: number;
};

/**
 * A saved prompt taken apart again. `rag` is null when the last user message
 * isn't in the builder's "Sources … Question" shape (raw chat, debugger).
 */
export type SplitPrompt = {
  system: string | null;
  history: ChatMessage[];
  lastUser: string;
  rag: { sources: SourceBlock[]; question: string; matchedChunks: boolean } | null;
};

export type PartKind = "system" | "history" | "framing" | "source" | "question" | "message";

export type PromptPart = {
  id: string;
  kind: PartKind;
  label: string;
  text: string;
  tokens: number;
  source?: SourceBlock;
};

type KnownChunk = { chunkId: string; score: number; label: string; content: string };

/**
 * Splits a saved final prompt into system, history and the last user message,
 * and that message into its sources and question.
 *
 * When the run's chunks are known (from run_chunks), the sources are rebuilt
 * from them and must match the saved text exactly. Otherwise, for example
 * after a document was deleted, the blocks are parsed back out of the text.
 */
export function splitPrompt(
  messages: ChatMessage[],
  opts: { question: string; chunks?: KnownChunk[] },
): SplitPrompt {
  const system = messages.filter((m) => m.role === "system");
  const rest = messages.filter((m) => m.role !== "system");
  const lastIndex = rest.findLastIndex((m) => m.role === "user");
  const lastUser = lastIndex >= 0 ? rest[lastIndex].content : "";
  const history = lastIndex >= 0 ? rest.slice(0, lastIndex) : rest;

  return {
    system: system.length ? system.map((m) => m.content).join("\n\n") : null,
    history,
    lastUser,
    rag: splitRagMessage(lastUser, opts.question, opts.chunks),
  };
}

function splitRagMessage(
  content: string,
  question: string,
  chunks?: KnownChunk[],
): SplitPrompt["rag"] {
  const suffix = `${QUESTION_PREFIX}${question}`;
  if (!content.startsWith(SOURCES_HEADER) || !content.endsWith(suffix)) return null;
  const middle = content.slice(SOURCES_HEADER.length, content.length - suffix.length);
  if (middle === NO_SOURCES) return { sources: [], question, matchedChunks: true };

  if (chunks?.length && formatSourceBlocks(chunks) === middle) {
    return {
      question,
      matchedChunks: true,
      sources: chunks.map((c, i) => ({ n: i + 1, ...c })),
    };
  }

  // Fallback: each block starts with a header line like "[2] notes.md (chunk 4)".
  // A chunk that itself contains such a line would split wrongly, which is
  // why the exact rebuild above is tried first.
  const blocks = middle.split(/\n\n(?=\[\d+\] [^\n]* \(chunk \d+\)\n)/);
  const sources: SourceBlock[] = [];
  for (const [i, block] of blocks.entries()) {
    const match = /^\[(\d+)\] ([^\n]*)\n([\s\S]*)$/.exec(block);
    if (!match || Number(match[1]) !== i + 1) return null;
    sources.push({ n: i + 1, label: match[2], content: match[3] });
  }
  return { sources, question, matchedChunks: false };
}

/**
 * The prompt as a list of parts with a token count each, in the order the
 * model reads them. `count` is injected so tests don't need a tokenizer.
 *
 * Counts are per part, so they won't add up exactly to the provider's total:
 * each message also carries role markers from the chat template, and
 * tokenizers merge characters differently at part boundaries.
 */
export function promptParts(split: SplitPrompt, count: (text: string) => number): PromptPart[] {
  const parts: PromptPart[] = [];
  const add = (part: Omit<PromptPart, "tokens">) =>
    parts.push({ ...part, tokens: count(part.text) });

  if (split.system != null)
    add({ id: "system", kind: "system", label: "System prompt", text: split.system });
  split.history.forEach((m, i) =>
    add({
      id: `history-${i}`,
      kind: "history",
      label: `History: ${m.role} (turn ${Math.floor(i / 2) + 1})`,
      text: m.content,
    }),
  );

  if (!split.rag) {
    add({ id: "message", kind: "message", label: "User message", text: split.lastUser });
    return parts;
  }

  const { sources, question } = split.rag;
  // The fixed wrapper text: "Sources:" header, blank lines between blocks
  // and the "Question:" label.
  const separators = "\n\n".repeat(Math.max(0, sources.length - 1));
  add({
    id: "framing",
    kind: "framing",
    label: "Framing",
    text: `${SOURCES_HEADER}${sources.length ? separators : NO_SOURCES}${QUESTION_PREFIX}`,
  });
  for (const s of sources) {
    add({
      id: `source-${s.n}`,
      kind: "source",
      label: `[${s.n}] ${s.label}`,
      // Counted with its header line, exactly as the model sees it.
      text: `[${s.n}] ${s.label}\n${s.content}`,
      source: s,
    });
  }
  add({ id: "question", kind: "question", label: "Question", text: question });
  return parts;
}

/**
 * The messages for a re-run: the same history and question with an edited
 * system prompt and only the kept sources, renumbered from 1.
 */
export function rebuildMessages(
  split: SplitPrompt,
  edits: { system: string; keep: (n: number) => boolean },
): ChatMessage[] {
  const messages: ChatMessage[] = [];
  if (edits.system.trim()) messages.push({ role: "system", content: edits.system });
  messages.push(...split.history);
  const last = split.rag
    ? ragUserMessage(
        formatSourceBlocks(split.rag.sources.filter((s) => edits.keep(s.n))),
        split.rag.question,
      )
    : split.lastUser;
  messages.push({ role: "user", content: last });
  return messages;
}
