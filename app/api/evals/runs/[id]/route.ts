import { z } from "zod";

import { checkPassword } from "@/lib/auth";
import { deleteEvalRun, getEvalRun } from "@/lib/db/evals";
import { EvalError, finishRun, judgeItems, reopenRun, runItem } from "@/lib/evals/runner";

// A judge call over a batch took 32–187 s from Gemini 3.8 Flash at a busy
// time, before any retries, so allow the Hobby plan's maximum.
export const maxDuration = 300;

const ID = /^[0-9a-f-]{36}$/i;

const stepSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("item"), itemId: z.uuid() }),
  z.object({ action: z.literal("judge"), itemIds: z.array(z.uuid()).min(1).max(10) }),
  z.object({ action: z.literal("finish"), error: z.string().max(500).optional() }),
  z.object({ action: z.literal("reopen") }),
]);

export async function GET(_request: Request, ctx: RouteContext<"/api/evals/runs/[id]">) {
  const run = await getEvalRun((await ctx.params).id);
  return run ? Response.json({ run }) : Response.json({ error: "Not found" }, { status: 404 });
}

/**
 * One step of a run: `item` (retrieve, maybe answer), `judge` (a batch),
 * `finish`, or `reopen` (a finished run with failed judge calls).
 */
export async function POST(request: Request, ctx: RouteContext<"/api/evals/runs/[id]">) {
  const auth = checkPassword(request);
  if (!auth.ok) return auth.response;
  const body = stepSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: z.prettifyError(body.error) }, { status: 400 });
  }
  const run = await getEvalRun((await ctx.params).id);
  if (!run) return Response.json({ error: "Not found" }, { status: 404 });

  try {
    const step = body.data;
    if (step.action === "item") return Response.json({ item: await runItem(run, step.itemId) });
    if (step.action === "judge")
      return Response.json({ call: await judgeItems(run, step.itemIds) });
    if (step.action === "reopen") {
      await reopenRun(run);
      return Response.json({ run: await getEvalRun(run.id) });
    }
    await finishRun(run, step.error);
    return Response.json({ run: await getEvalRun(run.id) });
  } catch (err) {
    if (err instanceof EvalError)
      return Response.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/evals/runs/[id]">) {
  const auth = checkPassword(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  if (!ID.test(id)) return Response.json({ error: "Bad id" }, { status: 400 });
  return (await deleteEvalRun(id))
    ? new Response(null, { status: 204 })
    : Response.json({ error: "Not found" }, { status: 404 });
}
