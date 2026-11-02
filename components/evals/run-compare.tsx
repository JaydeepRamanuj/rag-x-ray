"use client";

import { compareRank, pairedJudgeScores, type ItemChange } from "@/lib/evals/metrics";
import { describeConfig, type EvalItem, type EvalRunRow } from "@/lib/evals/types";

import { ChangeBadge, delta, fixed2, outOf5, pct, RankBadge } from "./shared";

/** Two runs side by side: the older one is the baseline (A), the newer one the change (B). */
export function RunCompare({ a, b, items }: { a: EvalRunRow; b: EvalRunRow; items: EvalItem[] }) {
  const resA = new Map(a.results.items.map((r) => [r.itemId, r]));
  const resB = new Map(b.results.items.map((r) => [r.itemId, r]));
  const questions = new Map(items.map((i) => [i.id, i.question]));
  // Only questions both runs asked are comparable.
  const shared = a.config.itemIds.filter((id) => b.config.itemIds.includes(id));
  const rows = shared.map((id) => {
    const ra = resA.get(id);
    const rb = resB.get(id);
    return {
      id,
      question: rb?.question ?? ra?.question ?? questions.get(id) ?? "(deleted item)",
      rankA: ra?.hitRank ?? null,
      rankB: rb?.hitRank ?? null,
      faithA: ra?.faithfulness ?? null,
      faithB: rb?.faithfulness ?? null,
      change: compareRank(ra?.hitRank ?? null, rb?.hitRank ?? null),
    };
  });
  const counts = rows.reduce(
    (acc, r) => ({ ...acc, [r.change]: (acc[r.change] ?? 0) + 1 }),
    {} as Partial<Record<ItemChange, number>>,
  );
  // Changed questions first, the biggest movements on top.
  const order: ItemChange[] = ["fixed", "broke", "better", "worse", "same"];
  rows.sort((x, y) => order.indexOf(x.change) - order.indexOf(y.change));
  const judged = a.config.mode === "full" && b.config.mode === "full";
  const paired = pairedJudgeScores(a.results.items, b.results.items);

  const metrics = [
    { name: "Hit rate", a: a.hitRate, b: b.hitRate, show: pct, digits: 2 },
    { name: "MRR", a: a.mrr, b: b.mrr, show: fixed2, digits: 2 },
    // Judge scores only over questions both runs had judged, so a run whose
    // judge calls failed partway is compared on the same questions.
    ...(judged
      ? [
          {
            name: `Faithfulness (${paired.count} judged in both)`,
            a: paired.faithfulness[0],
            b: paired.faithfulness[1],
            show: outOf5,
            digits: 1,
          },
          {
            name: `Relevance (${paired.count} judged in both)`,
            a: paired.relevance[0],
            b: paired.relevance[1],
            show: outOf5,
            digits: 1,
          },
        ]
      : []),
  ];

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Compare</h2>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <RunLabel tag="A" run={a} />
        <RunLabel tag="B" run={b} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map((m) => {
          const d = delta(m.a, m.b, m.digits);
          const up = m.a != null && m.b != null && m.b > m.a;
          const down = m.a != null && m.b != null && m.b < m.a;
          return (
            <div key={m.name} className="rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">{m.name}</p>
              <p className="text-lg font-semibold tabular-nums">
                {m.show(m.a)} → {m.show(m.b)}
              </p>
              <p
                className={`text-xs tabular-nums ${up ? "text-primary" : down ? "text-destructive" : "text-muted-foreground"}`}
              >
                {d}
              </p>
            </div>
          );
        })}
      </div>

      <p className="text-muted-foreground text-xs">
        {order
          .filter((c) => counts[c])
          .map((c) => `${counts[c]} ${c}`)
          .join(" · ")}
        . &quot;Fixed&quot; means B found the source passage and A didn&apos;t; &quot;better&quot;
        means B ranked it higher.
      </p>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
            <tr>
              <th className="p-2 font-medium">Question</th>
              <th className="p-2 font-medium">A</th>
              <th className="p-2 font-medium">B</th>
              <th className="p-2 font-medium">Change</th>
              {judged && <th className="p-2 text-right font-medium">Faithful A → B</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="max-w-md truncate p-2" title={r.question}>
                  {r.question}
                </td>
                <td className="p-2">
                  <RankBadge rank={r.rankA} />
                </td>
                <td className="p-2">
                  <RankBadge rank={r.rankB} />
                </td>
                <td className="p-2">
                  <ChangeBadge change={r.change} />
                </td>
                {judged && (
                  <td className="p-2 text-right tabular-nums">
                    {r.faithA ?? "–"} → {r.faithB ?? "–"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RunLabel({ tag, run }: { tag: string; run: EvalRunRow }) {
  return (
    <p className="rounded-md border p-2">
      <span className="font-semibold">{tag}</span>{" "}
      {run.config.label && <span className="font-medium">{run.config.label} · </span>}
      <span className="text-muted-foreground">
        {describeConfig(run.config)}
        {run.config.mode === "full" ? " · full" : ""}
      </span>
    </p>
  );
}
