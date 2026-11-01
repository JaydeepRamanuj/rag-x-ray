import { createGoogle } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type LanguageModelUsage,
} from "ai";
import { after } from "next/server";
import { z } from "zod";

import { checkPassword } from "@/lib/auth";
import {
  allChatModels,
  defaults,
  estimateCostUsd,
  getChatModel,
  type ChatModel,
} from "@/lib/config";
import { insertRun, type NewRunChunk } from "@/lib/db/runs";
import type { Usage } from "@/lib/llm";
import { buildRagMessages } from "@/lib/prompt/builder";
import { METHODS, retrieveForChat } from "@/lib/retrieval";

/**
 * The same RAG chat as /api/chat, with the model call and the stream handed
 * to the Vercel AI SDK. Retrieval and the prompt are shared code, so the
 * only difference is what lib/llm/ and lib/sse/ did by hand. The library
 * comparison page (/lab/sdk) puts the two side by side.
 */

export const maxDuration = 60;

const bodySchema = z.object({
  model: z.enum(allChatModels.map((m) => m.id) as [string, ...string[]]),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(20_000),
      }),
    )
    .min(1)
    .max(50),
  temperature: z.number().min(0).max(2).default(defaults.temperature),
  maxOutputTokens: z.number().int().min(16).max(8_192).default(defaults.maxOutputTokens),
  topK: z.number().int().min(1).max(20).default(defaults.topK),
  retrieval: z.enum(METHODS).default("vector"),
  rerank: z.boolean().default(false),
});

// The SDK reads GOOGLE_GENERATIVE_AI_API_KEY by default; this app's key has
// always been GEMINI_API_KEY, so it's passed in explicitly.
const google = createGoogle({ apiKey: process.env.GEMINI_API_KEY });
const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

/** One line per provider replaces lib/llm/gemini.ts and lib/llm/groq.ts. */
function sdkModel(
  model: ChatModel,
): Pick<Parameters<typeof streamText>[0], "model" | "providerOptions"> {
  return model.provider === "gemini"
    ? {
        model: google(model.id),
        providerOptions: { google: { thinkingConfig: { thinkingLevel: model.reasoning } } },
      }
    : { model: groq(model.id), providerOptions: { groq: { reasoningEffort: model.reasoning } } };
}

/**
 * The SDK's usage, in our shape. Its outputTokens already includes
 * reasoning (the same rule lib/llm/types.ts settled on by hand), and the
 * cache and reasoning counts moved into nested "details" objects in v7.
 */
function toUsage(u: LanguageModelUsage | undefined): Usage | null {
  if (!u || u.inputTokens == null) return null;
  return {
    inputTokens: u.inputTokens,
    outputTokens: u.outputTokens ?? 0,
    cachedTokens: u.inputTokenDetails?.cacheReadTokens ?? 0,
    reasoningTokens: u.outputTokenDetails?.reasoningTokens ?? 0,
  };
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }
  const body = parsed.data;
  if (body.rerank) {
    const auth = checkPassword(request);
    if (!auth.ok) return auth.response;
  }
  const model = getChatModel(body.model);
  const t0 = performance.now();
  const since = () => Math.round(performance.now() - t0);
  const runId = crypto.randomUUID();
  const question = body.messages.findLast((m) => m.role === "user")?.content ?? "";

  // Filled in as the stream runs, saved once it ends (or is stopped).
  const record = {
    answer: "",
    ttftMs: null as number | null,
    usage: null as Usage | null,
    finishReason: "unknown",
    status: "ok" as "ok" | "stopped" | "error",
    error: null as string | null,
    finalPrompt: body.messages as { role: string; content: string }[],
    embedTokens: null as number | null,
    chunks: [] as NewRunChunk[],
  };
  let settle: () => void;
  const settled = new Promise<void>((resolve) => (settle = resolve));

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      // Custom "data-*" parts carry what the SDK's protocol has no slot for.
      writer.write({ type: "data-run", data: { runId, model: model.id } });

      const found = await retrieveForChat(question, body.retrieval, {
        topK: body.topK,
        rerank: body.rerank,
      });
      const history = body.messages.slice(0, -1);
      const [system, ...messages] = buildRagMessages({ history, question, sources: found.sources });
      record.finalPrompt = [system, ...messages];
      record.embedTokens = found.query?.tokens ?? 0;
      record.chunks = found.sources.map((s, i) => ({
        runId,
        chunkId: s.chunkId,
        method: found.method,
        rank: i + 1,
        score: s.score,
        usedInPrompt: true,
      }));
      writer.write({
        type: "data-retrieval",
        data: {
          atMs: since(),
          embedMs: found.query?.ms ?? 0,
          searchMs: found.searchMs,
          sources: found.sources.map((s, i) => ({ n: i + 1, title: s.title, ordinal: s.ordinal })),
        },
      });

      const result = streamText({
        ...sdkModel(model),
        // v7 renamed `system` to `instructions`, and refuses system-role
        // messages inside `messages` unless explicitly allowed.
        instructions: system.content,
        messages: messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        temperature: body.temperature,
        maxOutputTokens: body.maxOutputTokens,
        abortSignal: request.signal,
        // Retries with backoff are built in (2 by default), replacing
        // lib/llm/retry.ts, but they're silent: nothing tells the client.
        onChunk: ({ chunk }) => {
          if (chunk.type !== "text-delta") return;
          record.ttftMs ??= since();
          record.answer += chunk.text;
        },
        onEnd: ({ usage, finishReason }) => {
          record.usage = toUsage(usage);
          record.finishReason = finishReason;
          settle();
        },
        // Usage arrives only with the finish part, so a stopped stream has
        // none (the hand-rolled Gemini adapter keeps a running total).
        onAbort: () => {
          record.status = "stopped";
          settle();
        },
        onError: ({ error }) => {
          record.status = "error";
          record.error = error instanceof Error ? error.message : String(error);
          settle();
        },
      });

      writer.merge(
        toUIMessageStream({
          stream: result.stream,
          // Metadata rides on the finish part, so the client gets the totals
          // in the same stream as the text.
          messageMetadata: ({ part }) =>
            part.type === "finish"
              ? { runId, ttftMs: record.ttftMs, totalMs: since(), usage: toUsage(part.totalUsage) }
              : undefined,
        }),
      );
    },
    // The default hides server errors behind "An error occurred."; this app
    // shows every error, as /api/chat does.
    onError: (error) => {
      record.status = "error";
      record.error = error instanceof Error ? error.message : String(error);
      settle();
      return record.error;
    },
  });

  after(async () => {
    await settled;
    const estCostUsd = record.usage ? estimateCostUsd(model.price, record.usage).toFixed(6) : null;
    try {
      await insertRun(
        {
          id: runId,
          question,
          config: {
            provider: model.provider,
            model: model.id,
            mode: "rag",
            engine: "ai-sdk",
            topK: body.topK,
            retrieval: body.retrieval,
            rerank: body.rerank,
            temperature: body.temperature,
            maxOutputTokens: body.maxOutputTokens,
            reasoning: model.reasoning,
            source: "sdk",
            finishReason: record.finishReason,
          },
          finalPrompt: record.finalPrompt,
          answer: record.answer,
          status: record.status,
          error: record.error,
          inputTokens: record.usage?.inputTokens,
          outputTokens: record.usage?.outputTokens,
          cachedTokens: record.usage?.cachedTokens,
          reasoningTokens: record.usage?.reasoningTokens,
          ttftMs: record.ttftMs,
          totalMs: since(),
          estCostUsd,
          embedTokens: record.embedTokens,
        },
        record.chunks,
      );
    } catch (err) {
      console.error(`Failed to save run ${runId}:`, err instanceof Error ? err.message : err);
    }
  });

  return createUIMessageStreamResponse({ stream });
}
