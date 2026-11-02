import { z } from "zod";

import { checkPassword } from "@/lib/auth";
import { retrieveAll } from "@/lib/retrieval";
import { explainQuery } from "@/lib/retrieval/keyword";

export const maxDuration = 60;

const bodySchema = z.object({
  query: z.string().trim().min(1).max(500),
  topK: z.number().int().min(1).max(20).default(10),
  model: z.enum(["gemini", "local"]).default("gemini"),
  rerank: z.boolean().default(true),
  /** Search these sets instead of each document's active one. */
  chunkSetIds: z.array(z.uuid()).max(50).optional(),
});

/**
 * One query through vector, keyword, hybrid and (optionally) hybrid +
 * rerank, for the retrieval arena. Reranking spends the Cohere trial's
 * 1,000 calls a month, so it needs the app password (open in local dev).
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }
  const { query, ...options } = parsed.data;
  if (options.rerank) {
    const auth = checkPassword(request);
    if (!auth.ok) return auth.response;
  }
  try {
    const [result, tsquery] = await Promise.all([retrieveAll(query, options), explainQuery(query)]);
    return Response.json({ ...result, tsquery }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
