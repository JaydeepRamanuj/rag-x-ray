import { z } from "zod";

import { DEFAULT_SEMANTIC_THRESHOLD } from "@/lib/chunking";
import { runLab } from "@/lib/chunking/lab";
import { getDocumentText } from "@/lib/db/chunk-sets";
import { embedLocalMemo } from "@/lib/embeddings/local";

const bodySchema = z.object({
  documentId: z.uuid(),
  chunkSize: z.number().int().min(100).max(1_000),
  overlapPct: z.number().min(0).max(30),
  threshold: z.number().min(-1).max(1).default(DEFAULT_SEMANTIC_THRESHOLD),
});

/**
 * Previews all four strategies in memory. Nothing is stored and no API
 * quota is used: semantic splitting runs on the local model, so the lab can
 * re-run on every slider move. Saving a strategy is /api/chunk-sets.
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }
  const { documentId, ...settings } = parsed.data;
  const doc = await getDocumentText(documentId);
  if (!doc) return Response.json({ error: "Document not found" }, { status: 404 });

  const result = await runLab(doc.rawText, settings, embedLocalMemo);
  return Response.json(
    { title: doc.title, text: doc.rawText, ...result },
    { headers: { "cache-control": "no-store" } },
  );
}
