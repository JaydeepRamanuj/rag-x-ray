import { z } from "zod";

import { checkPassword } from "@/lib/auth";
import { deleteEvalItem, updateEvalItem } from "@/lib/db/evals";

const ID = /^[0-9a-f-]{36}$/i;

const patchSchema = z
  .object({
    question: z.string().trim().min(5).max(1_000),
    expectedAnswer: z.string().trim().min(1).max(4_000),
    sourceText: z.string().trim().min(10).max(4_000),
  })
  .partial()
  .refine((p) => Object.keys(p).length > 0, "Send at least one field to change.");

export async function PATCH(request: Request, ctx: RouteContext<"/api/evals/items/[id]">) {
  const auth = checkPassword(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  if (!ID.test(id)) return Response.json({ error: "Bad id" }, { status: 400 });
  const body = patchSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: z.prettifyError(body.error) }, { status: 400 });
  }
  return (await updateEvalItem(id, body.data))
    ? new Response(null, { status: 204 })
    : Response.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/evals/items/[id]">) {
  const auth = checkPassword(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  if (!ID.test(id)) return Response.json({ error: "Bad id" }, { status: 400 });
  return (await deleteEvalItem(id))
    ? new Response(null, { status: 204 })
    : Response.json({ error: "Not found" }, { status: 404 });
}
