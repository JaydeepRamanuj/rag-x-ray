"use client";

import { useEffect, useRef, useState } from "react";

import { loadPassword, savePassword } from "@/lib/client/password";
import { itemDelayMs, judgeDelayMs, remainingWork } from "@/lib/evals/plan";
import type { EvalItem, EvalRunRow, JudgeCall, RunConfigInput } from "@/lib/evals/types";

import { EvalSet } from "./eval-set";
import { RunCompare } from "./run-compare";
import { RunDetail } from "./run-detail";
import { RunForm } from "./run-form";
import { RunsTable } from "./runs-table";

export type Progress = {
  runId: string;
  done: number;
  total: number;
  label: string;
  /** When the current wait ends, so the form can count down. */
  waitUntil: number | null;
};

export function Evals({
  initialItems,
  initialRuns,
}: {
  initialItems: EvalItem[];
  initialRuns: EvalRunRow[];
}) {
  const [items, setItems] = useState(initialItems);
  const [runs, setRuns] = useState(initialRuns);
  const [password, setPassword] = useState("");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(initialRuns[0]?.id ?? null);
  const [compare, setCompare] = useState<string[]>([]);
  const stopRef = useRef(false);

  useEffect(() => {
    // sessionStorage only exists in the browser; read it after mount.
    const id = setTimeout(() => setPassword(loadPassword()), 0);
    return () => clearTimeout(id);
  }, []);

  async function api<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
    const res = await fetch(url, {
      method: init?.method ?? "GET",
      headers: { "content-type": "application/json", "x-app-password": password },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
    if (res.status === 204) return undefined as T;
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? res.statusText);
    return json as T;
  }

  async function refreshRuns() {
    const { runs } = await api<{ runs: EvalRunRow[] }>("/api/evals/runs");
    setRuns(runs);
  }

  /** Swaps in the saved state of one run, so its rows fill in while it runs. */
  async function refreshRun(id: string) {
    const { run } = await api<{ run: EvalRunRow }>(`/api/evals/runs/${id}`);
    setRuns((rs) => rs.map((r) => (r.id === id ? run : r)));
  }

  async function refreshItems() {
    const { items } = await api<{ items: EvalItem[] }>("/api/evals/items");
    setItems(items);
  }

  /** Waits, but wakes early when Stop is pressed. */
  async function wait(ms: number) {
    const end = Date.now() + ms;
    setProgress((p) => (p ? { ...p, waitUntil: end } : p));
    while (Date.now() < end && !stopRef.current) {
      await new Promise((r) => setTimeout(r, 250));
    }
    setProgress((p) => (p ? { ...p, waitUntil: null } : p));
  }

  /** Sends a run's remaining steps one by one. Starting and resuming both land here. */
  async function drive(run: EvalRunRow) {
    stopRef.current = false;
    setError(null);
    setSelected(run.id);
    const work = remainingWork(run);
    const total = work.itemIds.length + work.judgeBatches.length;
    let done = 0;
    const step = (label: string) =>
      setProgress({ runId: run.id, done, total, label, waitUntil: null });
    const url = `/api/evals/runs/${run.id}`;
    let failure: string | undefined;

    try {
      // A finished run with failed judge calls goes back to "running" first.
      if (run.status !== "running") {
        step("Reopening");
        await api(url, { method: "POST", body: { action: "reopen" } });
      }
      for (const [i, itemId] of work.itemIds.entries()) {
        if (stopRef.current) break;
        step(`Question ${i + 1} of ${work.itemIds.length}`);
        await api(url, { method: "POST", body: { action: "item", itemId } });
        done++;
        await refreshRun(run.id);
        const more = i < work.itemIds.length - 1 || work.judgeBatches.length > 0;
        if (more) await wait(itemDelayMs(run.config));
      }
      for (const [i, itemIds] of work.judgeBatches.entries()) {
        if (stopRef.current) break;
        step(`Judging batch ${i + 1} of ${work.judgeBatches.length}`);
        try {
          const { call } = await api<{ call: JudgeCall }>(url, {
            method: "POST",
            body: { action: "judge", itemIds },
          });
          // A used-up daily quota won't come back for hours, and every
          // further call fails: stop judging and leave the run to Complete.
          if (call.error?.includes("per day")) {
            throw new Error(
              "The judge's daily request quota is used up. Use Complete on this run after it resets at midnight Pacific.",
            );
          }
          // The judge model returns 503 "high demand" at busy times; the
          // server already retried quickly, so try once more after a pause.
          if (call.error && !stopRef.current) {
            step(`Judging batch ${i + 1} again after: ${call.error.slice(0, 60)}`);
            await wait(judgeDelayMs(run.config.judgeModel) * 2);
            await api(url, { method: "POST", body: { action: "judge", itemIds } });
          }
        } catch (err) {
          // A batch whose questions all failed has nothing to judge; carry on.
          if (!(err instanceof Error && err.message.startsWith("None of those"))) throw err;
        }
        done++;
        await refreshRun(run.id);
        if (i < work.judgeBatches.length - 1) await wait(judgeDelayMs(run.config.judgeModel));
      }
      if (stopRef.current) failure = `Stopped after ${done} of ${total} steps.`;
    } catch (err) {
      failure = err instanceof Error ? err.message : String(err);
      setError(failure);
    }

    try {
      step("Scoring");
      await api(url, { method: "POST", body: { action: "finish", error: failure } });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setProgress(null);
    await refreshRuns().catch(() => {});
  }

  async function start(config: RunConfigInput) {
    savePassword(password);
    setError(null);
    try {
      const { run } = await api<{ run: EvalRunRow }>("/api/evals/runs", {
        method: "POST",
        body: config,
      });
      setRuns((rs) => [run, ...rs]);
      await drive(run);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function remove(id: string) {
    try {
      await api(`/api/evals/runs/${id}`, { method: "DELETE" });
      setRuns((rs) => rs.filter((r) => r.id !== id));
      setCompare((c) => c.filter((x) => x !== id));
      if (selected === id) setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function toggleCompare(id: string) {
    // Keeps the two most recent picks; the older one is the baseline.
    setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id].slice(-2)));
  }

  const selectedRun = runs.find((r) => r.id === selected);
  const compared = compare
    .map((id) => runs.find((r) => r.id === id))
    .filter((r): r is EvalRunRow => !!r)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return (
    <div className="flex flex-col gap-8">
      <RunForm
        itemCount={items.length}
        password={password}
        onPassword={setPassword}
        progress={progress}
        error={error}
        onStart={start}
        onStop={() => {
          stopRef.current = true;
        }}
      />

      <RunsTable
        runs={runs}
        selected={selected}
        compare={compare}
        busy={!!progress}
        activeRunId={progress?.runId ?? null}
        onSelect={setSelected}
        onToggleCompare={toggleCompare}
        onResume={(run) => drive(run)}
        onDelete={remove}
      />

      {compared.length === 2 && <RunCompare a={compared[0]} b={compared[1]} items={items} />}

      {selectedRun && <RunDetail run={selectedRun} items={items} />}

      <EvalSet
        items={items}
        api={api}
        onChanged={() => refreshItems().catch((err) => setError(String(err)))}
        onPasswordUsed={() => savePassword(password)}
      />
    </div>
  );
}
