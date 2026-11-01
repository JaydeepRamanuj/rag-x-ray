import { readFile } from "node:fs/promises";
import path from "node:path";

import { cacheLife } from "next/cache";

export type SourceFile = {
  path: string;
  /** What this file does in the request. */
  role: string;
  text: string;
  lines: number;
  /** Lines that are neither blank nor only a comment. */
  codeLines: number;
};

export type SourceSide = { label: string; files: SourceFile[]; lines: number; codeLines: number };

// Everything /api/chat needs to call a model and stream the answer, by hand.
// Retrieval and the prompt builder are left out: both routes share them.
const HAND_ROLLED: [string, string][] = [
  ["app/api/chat/route.ts", "Route: validate, retrieve, build prompt, stream SSE, save the run"],
  ["lib/llm/gemini.ts", "Gemini request shape, SSE chunk parsing, usage"],
  ["lib/llm/groq.ts", "Groq (OpenAI-style) request shape, SSE chunk parsing, usage"],
  ["lib/llm/types.ts", "Provider-neutral messages, usage and stream chunks"],
  ["lib/llm/retry.ts", "Retries with backoff that respect retry-after"],
  ["lib/sse/parser.ts", "SSE parser, used on the server and in the browser"],
  ["lib/sse/encoder.ts", "SSE encoder for our own events"],
  ["lib/chat/events.ts", "The event types the route sends"],
];

const SDK: [string, string][] = [
  ["app/api/chat-sdk/route.ts", "Route: the same steps, with streamText and the UI message stream"],
];

function countCode(text: string): number {
  let inBlock = false;
  let count = 0;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (inBlock) {
      if (line.includes("*/")) inBlock = false;
      continue;
    }
    if (line === "" || line.startsWith("//")) continue;
    if (line.startsWith("/*")) {
      inBlock = !line.includes("*/");
      continue;
    }
    count++;
  }
  return count;
}

async function load(label: string, list: [string, string][]): Promise<SourceSide> {
  const files = await Promise.all(
    list.map(async ([p, role]) => {
      const text = await readFile(path.join(process.cwd(), p), "utf8");
      return { path: p, role, text, lines: text.split("\n").length, codeLines: countCode(text) };
    }),
  );
  return {
    label,
    files,
    lines: files.reduce((s, f) => s + f.lines, 0),
    codeLines: files.reduce((s, f) => s + f.codeLines, 0),
  };
}

/**
 * The source files themselves, read when the page is prerendered. The files
 * are also listed in outputFileTracingIncludes, so a revalidation on the
 * server can still find them.
 */
export async function loadComparison() {
  "use cache";
  cacheLife("max");
  return Promise.all([load("Hand-rolled", HAND_ROLLED), load("Vercel AI SDK", SDK)]);
}
