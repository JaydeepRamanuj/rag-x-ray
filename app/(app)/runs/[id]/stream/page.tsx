import { notFound } from "next/navigation";
import { Suspense } from "react";

import { StreamDebugger, type SavedRun } from "@/components/stream-debugger/stream-debugger";
import { getRun } from "@/lib/db/runs";
import type { ChatMessage } from "@/lib/llm/types";

export default function StreamPage({ params }: PageProps<"/runs/[id]/stream">) {
  // The run comes from the database at request time, so it streams in behind
  // the prerendered shell rather than blocking it.
  return (
    <Suspense fallback={<div className="text-muted-foreground p-6 text-sm">Loading run…</div>}>
      <RunLoader params={params} />
    </Suspense>
  );
}

async function RunLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getRun(id);
  if (!run) notFound();

  const config = run.config as { model: string; provider: string; finishReason?: string };
  const saved: SavedRun = {
    id: run.id,
    question: run.question,
    answer: run.answer ?? "",
    status: run.status,
    error: run.error,
    model: config.model,
    messages: run.finalPrompt as ChatMessage[],
    inputTokens: run.inputTokens,
    outputTokens: run.outputTokens,
    ttftMs: run.ttftMs,
    totalMs: run.totalMs,
    estCostUsd: run.estCostUsd == null ? null : Number(run.estCostUsd),
    createdAt: run.createdAt?.toISOString() ?? null,
  };
  return <StreamDebugger run={saved} />;
}
