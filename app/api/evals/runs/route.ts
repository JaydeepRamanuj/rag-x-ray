import { z } from "zod";

import { checkPassword } from "@/lib/auth";
import { listEvalRuns } from "@/lib/db/evals";
import { EvalError, startRun } from "@/lib/evals/runner";
import { runConfigSchema } from "@/lib/evals/types";

export async function GET() {
  return Response.json({ runs: await listEvalRuns() });
}

/** Creates a run. The browser then sends its steps to /api/evals/runs/[id]. */
export async function POST(request: Request) {
  const auth = checkPassword(request);
  if (!auth.ok) return auth.response;
  const body = runConfigSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: z.prettifyError(body.error) }, { status: 400 });
  }
  try {
    return Response.json({ run: await startRun(body.data) }, { status: 201 });
  } catch (err) {
    if (err instanceof EvalError)
      return Response.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
