"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { loadPassword, savePassword } from "@/lib/client/password";
import { rerankModel } from "@/lib/config";
import type { ChunkSetRow } from "@/lib/db/chunk-sets";
import { formatInt, formatMs } from "@/lib/format";
import type { ArenaResult, RetrievedChunk } from "@/lib/retrieval";

type Result = ArenaResult & { tsquery: string };
type Shown = RetrievedChunk & { ranks?: (number | null)[]; previousRank?: number };

const TOP_K = [3, 5, 10, 15, 20];

export type ArenaInitial = { q?: string; k?: number; model?: string; rerank?: boolean };

export function RetrievalArena({ initial }: { initial: ArenaInitial }) {
  const [query, setQuery] = useState(initial.q ?? "");
  const [topK, setTopK] = useState(initial.k ?? 10);
  const [model, setModel] = useState<"gemini" | "local">(
    initial.model === "local" ? "local" : "gemini",
  );
  const [useRerank, setUseRerank] = useState(initial.rerank ?? true);
  const [scope, setScope] = useState("active");
  const [sets, setSets] = useState<ChunkSetRow[]>([]);
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [ran, setRan] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/chunk-sets", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        setPassword(loadPassword());
        setSets(json.chunkSets ?? []);
      })
      .catch(() => {});
  }, []);

  async function run(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim()) return;
    savePassword(password);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/retrieve", {
        method: "POST",
        headers: { "content-type": "application/json", "x-app-password": password },
        body: JSON.stringify({
          query,
          topK,
          model,
          rerank: useRerank,
          chunkSetIds: scopeIds(scope, sets),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setResult(json);
      setRan(query);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  // Ranks by chunk id per column, to show how far each method moved a chunk.
  const vectorRank = rankMap(result?.vector.chunks);
  const hybridRank = rankMap(result?.hybrid.chunks);
  const strategies = [...new Set(sets.map((s) => s.strategy))];

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={run} className="flex flex-col gap-4 rounded-lg border p-4">
        <div className="flex gap-2">
          <Input
            aria-label="Query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask something your documents answer, e.g. an exact error code or model name"
          />
          <Button type="submit" disabled={loading || !query.trim()}>
            {loading ? "Searching…" : "Search"}
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <Field id="arena-k" label="Top-k">
            <NativeSelect
              id="arena-k"
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
            >
              {TOP_K.map((k) => (
                <NativeSelectOption key={k} value={k}>
                  {k}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field id="arena-model" label="Embedding model">
            <NativeSelect
              id="arena-model"
              value={model}
              onChange={(e) => setModel(e.target.value as "gemini" | "local")}
            >
              <NativeSelectOption value="gemini">Gemini (768 dims)</NativeSelectOption>
              <NativeSelectOption value="local">
                all-MiniLM-L6-v2, local (384 dims)
              </NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field id="arena-scope" label="Chunk sets">
            <NativeSelect id="arena-scope" value={scope} onChange={(e) => setScope(e.target.value)}>
              <NativeSelectOption value="active">
                Active sets (what chat searches)
              </NativeSelectOption>
              {strategies.map((s) => (
                <NativeSelectOption key={s} value={`strategy:${s}`}>
                  Newest {s} set of each document
                </NativeSelectOption>
              ))}
              {sets.map((s) => (
                <NativeSelectOption key={s.id} value={s.id}>
                  {s.title}: {s.strategy} {s.chunkSize ?? ""} ({s.chunks} chunks)
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <div className="flex items-center gap-2 pb-1">
            <Switch id="arena-rerank" checked={useRerank} onCheckedChange={setUseRerank} />
            <Label htmlFor="arena-rerank">Rerank with Cohere</Label>
          </div>
          {useRerank && (
            <Field id="arena-password" label="Password (for rerank)">
              <Input
                id="arena-password"
                type="password"
                className="w-44"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="blank in local dev"
              />
            </Field>
          )}
        </div>
      </form>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {result && (
        <>
          <p className="text-muted-foreground text-xs">
            “{ran}”: query embedded in {formatMs(result.query.ms)}
            {result.query.cached ? " (cached)" : ""}. Hover a chunk to find it in every column.
          </p>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            <Column
              title="Vector"
              note={`Cosine similarity, ${model === "local" ? "local model" : "Gemini"}. ${formatMs(result.vector.ms)}.`}
              chunks={result.vector.chunks}
              hovered={hovered}
              onHover={setHovered}
              format={(c) => c.score.toFixed(3)}
            />
            <Column
              title="Keyword"
              note={
                <>
                  ts_rank_cd for{" "}
                  <code className="text-[11px]">{result.tsquery || "(no terms)"}</code>.{" "}
                  {formatMs(result.keyword.ms)}.
                </>
              }
              chunks={result.keyword.chunks}
              hovered={hovered}
              onHover={setHovered}
              format={(c) => c.score.toFixed(3)}
              badge={(c) => moved(vectorRank.get(c.chunkId), c, result.keyword.chunks, "vector")}
            />
            <Column
              title="Hybrid (RRF)"
              note="Σ 1/(60 + rank) over the vector and keyword lists. V and K are each list's rank."
              chunks={result.hybrid.chunks}
              hovered={hovered}
              onHover={setHovered}
              format={(c) => c.score.toFixed(4)}
              badge={(c) => (
                <span className="text-muted-foreground font-mono">
                  V{c.ranks?.[0] ?? "–"} · K{c.ranks?.[1] ?? "–"}
                </span>
              )}
            />
            {result.rerank === null ? (
              <EmptyColumn text="Rerank is off. Turn it on to reorder the hybrid candidates with a cross-encoder." />
            ) : "error" in result.rerank ? (
              <EmptyColumn text={`Rerank failed: ${result.rerank.error}`} error />
            ) : (
              <Column
                title="Hybrid + rerank"
                note={
                  <>
                    {rerankModel.label} relevance (0–1) over the top hybrid candidates.{" "}
                    {result.rerank.cached
                      ? "Cached: no API call."
                      : `${formatMs(result.rerank.ms)}, ${formatInt(result.rerank.billedTokens)} tokens billed.`}{" "}
                    {result.rerank.callsThisMonth != null &&
                      `${result.rerank.callsThisMonth} of ${formatInt(rerankModel.free.callsPerMonth)} calls this month.`}
                  </>
                }
                chunks={result.rerank.chunks}
                hovered={hovered}
                onHover={setHovered}
                format={(c) => c.score.toFixed(3)}
                badge={(c) =>
                  moved(
                    c.previousRank ?? hybridRank.get(c.chunkId),
                    c,
                    result.rerank && "chunks" in result.rerank ? result.rerank.chunks : [],
                    "hybrid",
                  )
                }
              />
            )}
          </div>
        </>
      )}

      {!result && !loading && (
        <p className="text-muted-foreground text-sm">
          Try a query with an exact identifier (a model name, an error code) and one phrased in your
          own words. See Lessons{" "}
          <Link href="/learn/hybrid-retrieval" className="underline">
            7
          </Link>{" "}
          and{" "}
          <Link href="/learn/reranking" className="underline">
            8
          </Link>
          .
        </p>
      )}
    </div>
  );
}

/** Turns the scope picker into chunk set ids; undefined means active sets. */
function scopeIds(scope: string, sets: ChunkSetRow[]): string[] | undefined {
  if (scope === "active") return undefined;
  if (scope.startsWith("strategy:")) {
    const strategy = scope.slice("strategy:".length);
    // Sets come newest first per document, so the first match per document wins.
    const newest = new Map<string, string>();
    for (const s of sets) {
      if (s.strategy === strategy && !newest.has(s.documentId)) newest.set(s.documentId, s.id);
    }
    return [...newest.values()];
  }
  return [scope];
}

function rankMap(chunks: { chunkId: string }[] | undefined) {
  return new Map((chunks ?? []).map((c, i) => [c.chunkId, i + 1]));
}

function moved(before: number | undefined, chunk: Shown, list: Shown[], from: string) {
  const now = list.findIndex((c) => c.chunkId === chunk.chunkId) + 1;
  if (before === undefined) return <Badge variant="outline">new vs {from}</Badge>;
  const d = before - now;
  if (d === 0) return <span className="text-muted-foreground font-mono">= {from}</span>;
  return (
    <span
      className={
        d > 0
          ? "font-mono text-emerald-600 dark:text-emerald-400"
          : "font-mono text-amber-600 dark:text-amber-400"
      }
      title={`Rank ${before} in ${from}`}
    >
      {d > 0 ? `↑${d}` : `↓${-d}`} from {before}
    </span>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function EmptyColumn({ text, error }: { text: string; error?: boolean }) {
  return (
    <section className="rounded-lg border border-dashed p-3">
      <h3 className="font-semibold">Hybrid + rerank</h3>
      <p className={error ? "text-destructive text-sm" : "text-muted-foreground text-sm"}>{text}</p>
    </section>
  );
}

function Column({
  title,
  note,
  chunks,
  hovered,
  onHover,
  format,
  badge,
}: {
  title: string;
  note: React.ReactNode;
  chunks: Shown[];
  hovered: string | null;
  onHover: (id: string | null) => void;
  format: (c: Shown) => string;
  badge?: (c: Shown) => React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-2 rounded-lg border p-3">
      <header>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-muted-foreground text-xs">{note}</p>
      </header>
      {chunks.length === 0 && <p className="text-muted-foreground text-sm">No matches.</p>}
      <ol className="flex flex-col gap-2">
        {chunks.map((c, i) => (
          <li
            key={c.chunkId}
            onMouseEnter={() => onHover(c.chunkId)}
            onMouseLeave={() => onHover(null)}
            className={`rounded border p-2 text-xs transition-colors ${hovered === c.chunkId ? "border-primary bg-primary/5" : ""}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono font-semibold">#{i + 1}</span>
              <span className="text-muted-foreground min-w-0 flex-1 truncate" title={c.title}>
                {c.title} · chunk {c.ordinal + 1}
              </span>
              <span className="font-mono">{format(c)}</span>
            </div>
            {badge && <div className="mt-0.5 text-[11px]">{badge(c)}</div>}
            {/* Click to unclamp: the whole chunk is what the prompt would get. */}
            <details className="group mt-1">
              <summary className="text-muted-foreground group-open:text-foreground line-clamp-3 cursor-pointer list-none whitespace-pre-wrap group-open:line-clamp-none">
                {c.content}
              </summary>
            </details>
          </li>
        ))}
      </ol>
    </section>
  );
}
