import { Suspense } from "react";

import { Ledger } from "@/components/ledger/ledger";
import { dailyUsage, listRuns, QUOTA_TIME_ZONE } from "@/lib/db/ledger";
import { summarizeRun } from "@/lib/db/runs";
import { lastDays } from "@/lib/ledger/days";
import { runForWhatIf } from "@/lib/ledger/inputs";

const DAYS = 14;
const MAX_RUNS = 200;

export default function LedgerPage({ searchParams }: PageProps<"/ledger">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">Token ledger</h1>
        <p className="text-muted-foreground text-sm">
          Every run&apos;s tokens, latency and what it would cost on the paid tier, plus daily usage
          against your free quota. Your real cost is $0.
        </p>
      </header>
      {/* Runs come from the database at request time, behind a static shell. */}
      <Suspense fallback={<p className="text-muted-foreground text-sm">Loading runs…</p>}>
        <LedgerLoader searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function LedgerLoader({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { run } = await searchParams;
  const [runs, usage] = await Promise.all([listRuns(MAX_RUNS), dailyUsage(DAYS)]);
  const rows = runs.map((r) => ({ ...summarizeRun(r), whatIf: runForWhatIf(r) }));

  return (
    <Ledger
      rows={rows}
      days={lastDays(DAYS, new Date(), QUOTA_TIME_ZONE)}
      usage={usage}
      initialRunId={typeof run === "string" ? run : undefined}
      maxRuns={MAX_RUNS}
    />
  );
}
