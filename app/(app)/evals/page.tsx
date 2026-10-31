import { io } from "next/cache";
import { Suspense } from "react";

import { Evals } from "@/components/evals/evals";
import { listEvalItems, listEvalRuns } from "@/lib/db/evals";

export default function EvalsPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">Evals</h1>
        <p className="text-muted-foreground text-sm">
          A fixed set of questions with known answers, run against one configuration at a time.
          Retrieval runs score hit rate and MRR with no LLM; full runs also answer every question
          and have a stronger model judge faithfulness and relevance. Change one setting, run again,
          and compare.
        </p>
      </header>
      <Suspense fallback={<p className="text-muted-foreground text-sm">Loading the eval set…</p>}>
        <EvalsLoader />
      </Suspense>
    </div>
  );
}

async function EvalsLoader() {
  // Runs change on every visit, so keep them out of the static shell.
  await io();
  const [items, runs] = await Promise.all([listEvalItems(), listEvalRuns()]);
  return <Evals initialItems={items} initialRuns={runs} />;
}
