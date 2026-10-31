import { after } from "next/server";
import { z } from "zod";

import type { ChatEventMap, ChatEventName } from "@/lib/chat/events";
import { allChatModels, defaults, estimateCostUsd, getChatModel } from "@/lib/config";
import { insertRun, type NewRun } from "@/lib/db/runs";
import { getProvider, type Usage } from "@/lib/llm";
import { HttpError } from "@/lib/llm/retry";
import { encodeSse, sseHeaders } from "@/lib/sse/encoder";

// Generous enough for a slow answer from a busy model plus retries.
export const maxDuration = 60;

const bodySchema = z.object({
  model: z.enum(allChatModels.map((m) => m.id) as [string, ...string[]]),
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        // Caps keep a public URL from being used to burn the free quota.
        content: z.string().min(1).max(20_000),
      }),
    )
    .min(1)
    .max(50),
  temperature: z.number().min(0).max(2).default(defaults.temperature),
  maxOutputTokens: z.number().int().min(16).max(8_192).default(defaults.maxOutputTokens),
  /** Forward raw upstream frames for the streaming debugger. */
  debug: z.boolean().default(false),
  source: z.enum(["chat", "debugger"]).default("chat"),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }
  const body = parsed.data;
  const model = getChatModel(body.model);
  const provider = getProvider(model.provider);

  const t0 = performance.now();
  const since = () => Math.round(performance.now() - t0);
  // The id is made here, not by the database, so the client gets it in the
  // first event instead of waiting for an insert (Neon may be cold).
  const runId = crypto.randomUUID();
  const question = body.messages.findLast((m) => m.role === "user")?.content ?? "";

  // Aborting this cancels the upstream fetch, so a stopped stream stops
  // generating (and costing) tokens at the provider too.
  const upstream = new AbortController();
  request.signal.addEventListener("abort", () => upstream.abort("client disconnected"));

  let resolveRun: (run: NewRun) => void;
  const runRecord = new Promise<NewRun>((resolve) => (resolveRun = resolve));

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = <K extends ChatEventName>(event: K, data: ChatEventMap[K]) => {
        if (!open) return;
        try {
          controller.enqueue(encodeSse(event, data));
        } catch {
          open = false; // the client went away; keep going so the run is saved
        }
      };

      let answer = "";
      let usage: Usage | null = null;
      let finishReason = "unknown";
      let ttftMs: number | null = null;
      let lastTokenMs: number | null = null;
      let status: "ok" | "stopped" | "error" = "ok";
      let errorMessage: string | null = null;

      send("start", { runId, model: model.id, provider: model.provider });

      try {
        const result = await provider.chatStream({
          model,
          messages: body.messages,
          temperature: body.temperature,
          maxOutputTokens: body.maxOutputTokens,
          signal: upstream.signal,
          onRetry: (info) => send("retry", { ...info, atMs: since() }),
        });
        send("meta", { atMs: since(), attempts: result.attempts, headers: result.headers });

        for await (const chunk of result.chunks) {
          if (chunk.type === "raw") {
            if (body.debug) send("upstream", { atMs: since(), data: chunk.data });
          } else if (chunk.type === "text") {
            ttftMs ??= since();
            lastTokenMs = since();
            answer += chunk.text;
            send("token", { text: chunk.text });
          } else if (chunk.type === "usage") {
            // Both providers can repeat an unchanged total; only send changes.
            if (JSON.stringify(chunk.usage) !== JSON.stringify(usage)) send("usage", chunk.usage);
            usage = chunk.usage;
          } else {
            finishReason = chunk.reason;
          }
        }
      } catch (err) {
        if (upstream.signal.aborted) {
          status = "stopped";
        } else {
          status = "error";
          errorMessage = err instanceof Error ? err.message : String(err);
          send("error", {
            runId,
            message: errorMessage,
            status: err instanceof HttpError ? err.status : undefined,
          });
        }
      }

      const totalMs = since();
      const estCostUsd = usage ? Number(estimateCostUsd(model.price, usage).toFixed(6)) : null;
      if (status !== "error") {
        send("done", {
          runId,
          status,
          finishReason,
          ttftMs,
          totalMs,
          lastTokenMs,
          usage,
          estCostUsd,
        });
      }

      resolveRun({
        id: runId,
        question,
        config: {
          provider: model.provider,
          model: model.id,
          temperature: body.temperature,
          maxOutputTokens: body.maxOutputTokens,
          reasoning: model.reasoning,
          source: body.source,
          finishReason,
        },
        finalPrompt: body.messages,
        answer,
        status,
        error: errorMessage,
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
        cachedTokens: usage?.cachedTokens,
        ttftMs,
        totalMs,
        estCostUsd: estCostUsd?.toString(),
      });

      if (open) controller.close();
    },
    cancel() {
      upstream.abort("client cancelled");
    },
  });

  // Saving after the response keeps the database write off the user's
  // critical path, and still runs if the client disconnected mid-stream.
  after(async () => {
    try {
      await insertRun(await runRecord);
    } catch (err) {
      console.error(`Failed to save run ${runId}:`, err instanceof Error ? err.message : err);
    }
  });

  return new Response(stream, { headers: sseHeaders });
}
