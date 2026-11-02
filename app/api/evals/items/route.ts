import { z } from "zod";

import draftSet from "@/content/evals/eval-set.json";
import { checkPassword } from "@/lib/auth";
import { insertEvalItems, listEvalItems } from "@/lib/db/evals";

const itemSchema = z.object({
  question: z.string().trim().min(5).max(1_000),
  expectedAnswer: z.string().trim().min(1).max(4_000),
  sourceText: z.string().trim().min(10).max(4_000),
});

export async function GET() {
  return Response.json({ items: await listEvalItems() });
}

/**
 * `{ import: "draft" }` loads the drafted set from content/evals, for a
 * fresh database. `{ items: [...] }` adds items written by hand.
 */
export async function POST(request: Request) {
  const auth = checkPassword(request);
  if (!auth.ok) return auth.response;
  const body = z
    .union([
      z.object({ import: z.literal("draft") }),
      z.object({ items: z.array(itemSchema).min(1).max(100) }),
    ])
    .safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: z.prettifyError(body.error) }, { status: 400 });
  }

  let items: z.infer<typeof itemSchema>[];
  if ("import" in body.data) {
    if ((await listEvalItems()).length > 0) {
      return Response.json(
        { error: "The eval set already has items; importing again would duplicate them." },
        { status: 409 },
      );
    }
    items = z.array(itemSchema).parse(draftSet);
  } else {
    items = body.data.items;
  }
  const added = await insertEvalItems(items);
  return Response.json({ added }, { status: 201 });
}
