import { z } from "zod";

import { checkPassword } from "@/lib/auth";
import { activateChunkSet, deleteChunkSet } from "@/lib/db/chunk-sets";

const ID = /^[0-9a-f-]{36}$/i;

/** `{ active: true }` makes this the set chat searches for its document. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/chunk-sets/[id]">) {
  const auth = checkPassword(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  if (!ID.test(id)) return Response.json({ error: "Bad id" }, { status: 400 });
  const body = z
    .object({ active: z.literal(true) })
    .safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Send { active: true }" }, { status: 400 });

  return (await activateChunkSet(id))
    ? new Response(null, { status: 204 })
    : Response.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/chunk-sets/[id]">) {
  const auth = checkPassword(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  if (!ID.test(id)) return Response.json({ error: "Bad id" }, { status: 400 });

  const result = await deleteChunkSet(id);
  if (result === "deleted") return new Response(null, { status: 204 });
  if (result === "active") {
    return Response.json(
      { error: "This is the document's active set. Activate another one first." },
      { status: 409 },
    );
  }
  return Response.json({ error: "Not found" }, { status: 404 });
}
