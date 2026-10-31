import { checkPassword } from "@/lib/auth";
import { deleteDocument } from "@/lib/db/documents";

export async function DELETE(request: Request, ctx: RouteContext<"/api/documents/[id]">) {
  const auth = checkPassword(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Bad id" }, { status: 400 });
  const deleted = await deleteDocument(id);
  return deleted
    ? new Response(null, { status: 204 })
    : Response.json({ error: "Not found" }, { status: 404 });
}
