import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PromptInspector } from "@/components/prompt-inspector/prompt-inspector";
import { getReruns, getRun, getRunChunks, summarizeRun } from "@/lib/db/runs";
import type { ChatMessage } from "@/lib/llm/types";
import { promptParts, splitPrompt } from "@/lib/prompt/anatomy";
import { sourceLabel } from "@/lib/prompt/builder";
import { estimateTokens } from "@/lib/tokens/count";

export default function PromptPage({ params }: PageProps<"/runs/[id]/prompt">) {
  return (
    <Suspense fallback={<div className="text-muted-foreground p-6 text-sm">Loading run…</div>}>
      <RunLoader params={params} />
    </Suspense>
  );
}

/**
 * A run is saved after its response finishes, so clicking Inspect the
 * instant an answer completes can arrive before the insert. Wait briefly
 * rather than show "not found" for a run that's about to exist.
 */
async function getRunPatiently(id: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const run = await getRun(id);
    if (run) return run;
    await new Promise((r) => setTimeout(r, 500));
  }
  return undefined;
}

async function RunLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getRunPatiently(id);
  if (!run) notFound();

  const summary = summarizeRun(run);
  const [chunkRows, reruns] = await Promise.all([getRunChunks(id), getReruns(id)]);
  const used = chunkRows.filter((c) => c.usedInPrompt);
  const split = splitPrompt(run.finalPrompt as ChatMessage[], {
    question: run.question,
    chunks: used.map((c) => ({
      chunkId: c.chunkId,
      score: c.score,
      label: sourceLabel(c),
      content: c.content,
    })),
  });
  // Estimated here, on the server, so the tokenizer's large vocabulary
  // file never ships to the browser.
  const parts = promptParts(split, estimateTokens);
  const removed = chunkRows
    .filter((c) => !c.usedInPrompt)
    .map((c) => ({ label: sourceLabel(c), rank: c.rank, score: c.score }));

  return (
    <PromptInspector
      run={summary}
      split={split}
      parts={parts}
      removed={removed}
      reruns={reruns.map(summarizeRun)}
    />
  );
}
