"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { loadPassword, savePassword } from "@/lib/client/password";
import type { LabResult, LabStrategyResult } from "@/lib/chunking/lab";
import { cutsWord, segmentsFor } from "@/lib/chunking/segments";
import { STRATEGIES, type Chunk, type Strategy } from "@/lib/chunking/types";
import type { ChunkSetRow } from "@/lib/db/chunk-sets";
import { formatInt, formatMs } from "@/lib/format";

type Doc = { id: string; title: string; tokenCount: number };
type Preview = LabResult & { title: string; text: string };

const BLURB: Record<Strategy, string> = {
  fixed: "Exactly N tokens, cut wherever that lands.",
  recursive: "Paragraphs, then lines, sentences, clauses, words.",
  sentence: "Whole sentences packed up to N tokens.",
  semantic: "Cut where neighbouring sentences stop being alike.",
};

export type LabInitial = {
  doc?: string;
  size?: number;
  overlap?: number;
  threshold?: number;
};

export function ChunkingLab({ initial }: { initial: LabInitial }) {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [docId, setDocId] = useState(initial.doc ?? "");
  const [chunkSize, setChunkSize] = useState(initial.size ?? 400);
  const [overlapPct, setOverlapPct] = useState(initial.overlap ?? 10);
  const [threshold, setThreshold] = useState(initial.threshold ?? 0.4);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [sets, setSets] = useState<ChunkSetRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inflight = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/documents", { cache: "no-store" })
      .then((r) => r.json())
      .then((json: { documents: Doc[] }) => {
        // Storage only exists in the browser, so the password is restored
        // after mount rather than in the initial state.
        setPassword(loadPassword());
        setDocs(json.documents);
        setDocId((current) =>
          json.documents.some((d) => d.id === current) ? current : (json.documents[0]?.id ?? ""),
        );
      })
      .catch((err) => setError(String(err)));
  }, []);

  const refreshSets = useCallback(async (id: string) => {
    const res = await fetch(`/api/chunk-sets?documentId=${id}`, { cache: "no-store" });
    if (res.ok) setSets((await res.json()).chunkSets);
  }, []);

  // Every slider move re-chunks on the server. Debounced, and a newer
  // request cancels the one still in flight so results never arrive out of order.
  useEffect(() => {
    if (!docId) return;
    const timer = setTimeout(async () => {
      inflight.current?.abort();
      const controller = new AbortController();
      inflight.current = controller;
      setLoading(true);
      try {
        const res = await fetch("/api/lab/chunk", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ documentId: docId, chunkSize, overlapPct, threshold }),
          signal: controller.signal,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? res.statusText);
        setPreview(json);
        setError(null);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [docId, chunkSize, overlapPct, threshold]);

  useEffect(() => {
    if (!docId) return;
    let current = true;
    fetch(`/api/chunk-sets?documentId=${docId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => current && setSets(json.chunkSets ?? []))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [docId]);

  async function call(label: string, url: string, init: RequestInit) {
    savePassword(password);
    setBusy(label);
    setNotice(null);
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "content-type": "application/json", "x-app-password": password },
      });
      const json = res.status === 204 ? {} : await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      await refreshSets(docId);
      return json;
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function save(strategy: Strategy) {
    const json = await call(`save-${strategy}`, "/api/chunk-sets", {
      method: "POST",
      body: JSON.stringify({ documentId: docId, strategy, chunkSize, overlapPct, threshold }),
    });
    if (json) {
      setNotice(
        `Saved ${json.chunks} ${strategy} chunks as a new set${json.local ? "" : " (no local vectors: the local model isn't available here)"}. It's inactive until you make it active.`,
      );
    }
  }

  const doc = docs?.find((d) => d.id === docId);
  const overlapTokens = Math.round((chunkSize * overlapPct) / 100);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-wrap items-end gap-x-6 gap-y-4 rounded-lg border p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lab-doc">Document</Label>
          <NativeSelect
            id="lab-doc"
            value={docId}
            onChange={(e) => setDocId(e.target.value)}
            disabled={!docs?.length}
          >
            {docs?.length === 0 && (
              <NativeSelectOption value="">No documents yet</NativeSelectOption>
            )}
            {docs?.map((d) => (
              <NativeSelectOption key={d.id} value={d.id}>
                {d.title} ({formatInt(d.tokenCount)} tokens)
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <Slider
          id="lab-size"
          label="Chunk size"
          value={chunkSize}
          min={100}
          max={1000}
          step={50}
          display={`${chunkSize} tokens`}
          onChange={setChunkSize}
        />
        <Slider
          id="lab-overlap"
          label="Overlap"
          value={overlapPct}
          min={0}
          max={30}
          step={5}
          display={`${overlapPct}% (${overlapTokens} tokens)`}
          onChange={setOverlapPct}
        />
        <Slider
          id="lab-threshold"
          label="Semantic threshold"
          value={threshold}
          min={0}
          max={0.9}
          step={0.05}
          display={threshold.toFixed(2)}
          onChange={setThreshold}
        />
        <span className="text-muted-foreground text-xs">{loading ? "Chunking…" : " "}</span>
      </section>

      {docs?.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Upload a document on{" "}
          <Link href="/documents" className="underline">
            Documents
          </Link>{" "}
          first.
        </p>
      )}
      {error && <p className="text-destructive text-sm">{error}</p>}

      {preview && (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {STRATEGIES.map((s) => (
            <StrategyColumn
              key={s}
              strategy={s}
              result={preview.strategies[s]}
              text={preview.text}
              threshold={threshold}
              saving={busy === `save-${s}`}
              disabled={busy !== null}
              onSave={() => save(s)}
            />
          ))}
        </div>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold">Saved chunk sets{doc ? ` for ${doc.title}` : ""}</h2>
            <p className="text-muted-foreground text-sm">
              Chat searches each document&apos;s active set. Saving embeds the chunks with Gemini
              (cached chunks are free) and the local model. The{" "}
              <Link href="/lab/retrieval" className="underline">
                retrieval arena
              </Link>{" "}
              can search any set.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lab-password">Upload password</Label>
            <Input
              id="lab-password"
              type="password"
              className="w-48"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="blank in local dev"
            />
          </div>
        </div>
        {notice && <p className="text-sm">{notice}</p>}
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground bg-muted/40 text-left text-xs">
              <tr>
                <th className="px-2 py-1.5">Strategy</th>
                <th className="px-2 text-right">Size</th>
                <th className="px-2 text-right">Overlap</th>
                <th className="px-2 text-right">Threshold</th>
                <th className="px-2 text-right">Chunks</th>
                <th className="px-2 text-right">Avg tokens</th>
                <th className="px-2 text-right">Gemini / local vectors</th>
                <th className="px-2" />
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {sets.map((set) => (
                <tr key={set.id} className="border-t">
                  <td className="px-2 py-1.5 font-sans">
                    {set.strategy} {set.isActive && <Badge variant="secondary">active</Badge>}
                  </td>
                  <td className="px-2 text-right">{set.chunkSize ?? "–"}</td>
                  <td className="px-2 text-right">{set.overlap ?? "–"}</td>
                  <td className="px-2 text-right">{set.threshold?.toFixed(2) ?? "–"}</td>
                  <td className="px-2 text-right">{set.chunks}</td>
                  <td className="px-2 text-right">{set.avgTokens}</td>
                  <td className="px-2 text-right">
                    {set.withGemini} / {set.withLocal}
                  </td>
                  <td className="flex flex-wrap justify-end gap-1 px-2 py-1 font-sans">
                    {!set.isActive && (
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={busy !== null}
                        onClick={() =>
                          call(`act-${set.id}`, `/api/chunk-sets/${set.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({ active: true }),
                          })
                        }
                      >
                        Make active
                      </Button>
                    )}
                    {(["gemini", "local"] as const).map((model) =>
                      (model === "gemini" ? set.withGemini : set.withLocal) < set.chunks ? (
                        <Button
                          key={model}
                          size="xs"
                          variant="outline"
                          disabled={busy !== null}
                          onClick={() =>
                            call(`emb-${set.id}`, `/api/chunk-sets/${set.id}/embed`, {
                              method: "POST",
                              body: JSON.stringify({ model }),
                            })
                          }
                        >
                          {busy === `emb-${set.id}` ? "Embedding…" : `Embed ${model}`}
                        </Button>
                      ) : null,
                    )}
                    {!set.isActive && (
                      <Button
                        size="xs"
                        variant="ghost"
                        disabled={busy !== null}
                        onClick={() =>
                          call(`del-${set.id}`, `/api/chunk-sets/${set.id}`, { method: "DELETE" })
                        }
                      >
                        Delete
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Slider(props: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex w-52 flex-col gap-1.5">
      <Label htmlFor={props.id} className="flex justify-between">
        <span>{props.label}</span>
        <span className="text-muted-foreground font-mono text-xs">{props.display}</span>
      </Label>
      <input
        id={props.id}
        type="range"
        className="accent-primary"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </div>
  );
}

function StrategyColumn({
  strategy,
  result,
  text,
  threshold,
  saving,
  disabled,
  onSave,
}: {
  strategy: Strategy;
  result: LabStrategyResult;
  text: string;
  threshold: number;
  saving: boolean;
  disabled: boolean;
  onSave: () => void;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-lg border p-3">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold capitalize">{strategy}</h3>
          <p className="text-muted-foreground text-xs">{BLURB[strategy]}</p>
        </div>
        <Button size="xs" variant="outline" disabled={disabled || !result.ok} onClick={onSave}>
          {saving ? "Saving…" : "Save as set"}
        </Button>
      </header>
      {!result.ok ? (
        <p className="text-destructive text-sm">{result.error}</p>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
            <Stat label="Chunks" value={formatInt(result.stats.chunks)} />
            <Stat
              label="Avg ± spread"
              value={`${result.stats.avgTokens} ± ${result.stats.stdTokens}`}
            />
            <Stat label="Min–max" value={`${result.stats.minTokens}–${result.stats.maxTokens}`} />
            <Stat
              label="Sentences cut"
              value={`${result.stats.cutSentences} / ${result.stats.sentences}`}
              warn={result.stats.cutSentences > 0}
            />
            <Stat label="Stored / source" value={`${result.stats.duplication.toFixed(2)}×`} />
            <Stat label="Time" value={formatMs(result.ms)} />
          </dl>
          {result.semantic && (
            <SimilarityCurve similarities={result.semantic.similarities} threshold={threshold} />
          )}
          <Highlighted text={text} chunks={result.chunks} />
        </>
      )}
    </section>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex flex-col">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={warn ? "font-mono text-amber-600 dark:text-amber-400" : "font-mono"}>
        {value}
      </dd>
    </div>
  );
}

/** Neighbour similarity along the document; dots below the line are cuts. */
function SimilarityCurve({
  similarities,
  threshold,
}: {
  similarities: number[];
  threshold: number;
}) {
  const w = 300;
  const h = 56;
  if (similarities.length < 2) return null;
  const x = (i: number) => (i / (similarities.length - 1)) * w;
  const y = (s: number) => h - Math.max(0, Math.min(1, s)) * h;
  const path = similarities
    .map((s, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(s).toFixed(1)}`)
    .join("");
  const cuts = similarities.flatMap((s, i) => (s < threshold ? [i] : []));
  return (
    <figure className="flex flex-col gap-1">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-14 w-full" preserveAspectRatio="none" role="img">
        <title>{`Similarity between neighbouring sentences; ${cuts.length} fall below ${threshold.toFixed(2)}`}</title>
        <path
          d={path}
          fill="none"
          className="stroke-muted-foreground"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={0}
          x2={w}
          y1={y(threshold)}
          y2={y(threshold)}
          className="stroke-amber-500"
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />
        {cuts.map((i) => (
          <circle key={i} cx={x(i)} cy={y(similarities[i])} r={1.8} className="fill-amber-500" />
        ))}
      </svg>
      <figcaption className="text-muted-foreground text-xs">
        Similarity of each sentence window to the next (0–1). {cuts.length} drops below the dashed
        threshold; the size cap adds the rest.
      </figcaption>
    </figure>
  );
}

const TONES = ["bg-sky-500/15", "bg-emerald-500/15"];

/** The source text with each chunk tinted; overlaps darker, mid-word cuts marked. */
function Highlighted({ text, chunks }: { text: string; chunks: Chunk[] }) {
  const segments = useMemo(() => segmentsFor(text.length, chunks), [text, chunks]);
  const starts = useMemo(() => new Map(chunks.map((c, i) => [c.startChar, i])), [chunks]);
  const badEnds = useMemo(
    () => new Set(chunks.filter((c) => cutsWord(text, c.endChar)).map((c) => c.endChar)),
    [text, chunks],
  );
  return (
    <div className="bg-muted/20 max-h-[60vh] overflow-y-auto rounded border p-2 text-xs leading-relaxed whitespace-pre-wrap">
      {segments.map((seg) => {
        const startOf = starts.get(seg.start);
        const tone =
          seg.cover > 1
            ? "bg-violet-500/35"
            : seg.chunk === null
              ? ""
              : TONES[seg.chunk % TONES.length];
        return (
          <span key={seg.start}>
            {startOf !== undefined && (
              <sup className="text-muted-foreground mr-0.5 font-mono select-none">
                {startOf + 1}
              </sup>
            )}
            <span
              className={tone}
              title={
                seg.chunk === null
                  ? undefined
                  : `Chunk ${seg.chunk + 1} · ${chunks[seg.chunk].tokenCount} tokens${seg.cover > 1 ? " · overlap" : ""}`
              }
            >
              {text.slice(seg.start, seg.end)}
            </span>
            {badEnds.has(seg.end) && (
              <span className="text-destructive font-bold select-none" title="Cut mid-word">
                ✂
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
