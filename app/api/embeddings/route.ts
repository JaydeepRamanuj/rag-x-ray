import { z } from "zod";

import { activeChunkVectors } from "@/lib/db/explorer";
import { embedTexts } from "@/lib/embeddings";
import { embedLocal } from "@/lib/embeddings/local";

export const maxDuration = 60;

const modelSchema = z.enum(["gemini", "local"]);

/** Every active chunk's vector for one model, for the embedding explorer. */
export async function GET(request: Request) {
  const parsed = modelSchema.safeParse(new URL(request.url).searchParams.get("model") ?? "gemini");
  if (!parsed.success)
    return Response.json({ error: "model must be gemini or local" }, { status: 400 });
  try {
    const points = await activeChunkVectors(parsed.data);
    return Response.json(
      { model: parsed.data, points },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}

const bodySchema = z.object({
  texts: z.array(z.string().trim().min(1).max(500)).min(1).max(2),
  model: modelSchema,
  /**
   * "query" embeds like a chat question (RETRIEVAL_QUERY), so it lands where
   * retrieval would look. "similarity" embeds both sides the same way
   * (SEMANTIC_SIMILARITY), for comparing two sentences. Local ignores it.
   */
  task: z.enum(["query", "similarity"]).default("query"),
});

/**
 * Embeds one or two short texts, for the explorer's query star and the
 * similarity playground. Public like chat: Gemini calls are cached in
 * Upstash by text and task, and the local model costs nothing.
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }
  const { texts, model, task } = parsed.data;
  const t0 = performance.now();
  try {
    if (model === "local") {
      const vectors = await embedLocal(texts);
      return Response.json({
        vectors,
        ms: Math.round(performance.now() - t0),
        cached: 0,
        tokens: 0,
      });
    }
    const result = await embedTexts(
      texts,
      task === "query" ? "RETRIEVAL_QUERY" : "SEMANTIC_SIMILARITY",
    );
    return Response.json({
      vectors: result.vectors,
      ms: Math.round(performance.now() - t0),
      cached: result.cacheHits,
      tokens: result.embeddedTokens,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
