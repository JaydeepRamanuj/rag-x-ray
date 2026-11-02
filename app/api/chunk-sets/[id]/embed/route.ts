import { z } from "zod";

import { checkPassword } from "@/lib/auth";
import { chunksMissing, setEmbeddings } from "@/lib/db/chunk-sets";
import { embedChunksGemini } from "@/lib/ingest/embed-chunks";
import { embedLocal } from "@/lib/embeddings/local";

export const maxDuration = 300;

/**
 * Fills in whichever vectors a set is missing for one model: the
 * "re-embed" button. Chunks from before Phase 4 have no local vectors, and
 * a set saved where the local model couldn't run has none either.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/chunk-sets/[id]/embed">) {
  const auth = checkPassword(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Bad id" }, { status: 400 });
  const body = z
    .object({ model: z.enum(["gemini", "local"]) })
    .safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Send { model }" }, { status: 400 });

  try {
    const missing = await chunksMissing(id, body.data.model);
    const texts = missing.map((m) => m.content);
    const vectors =
      body.data.model === "local"
        ? await embedLocal(texts)
        : await embedChunksGemini(texts, {
            documentId: null,
            title: `re-embed set ${id.slice(0, 8)}`,
          });
    await setEmbeddings(
      body.data.model,
      missing.map((m) => m.id),
      vectors,
    );
    return Response.json({ embedded: missing.length });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
