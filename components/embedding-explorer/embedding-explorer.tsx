"use client";

import { useEffect, useMemo, useState } from "react";
import { UMAP } from "umap-js";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { ChunkPoint } from "@/lib/db/explorer";
import { nearest, nearest2d, truncateVector, type Neighbour } from "@/lib/embeddings/vector-math";
import { formatMs } from "@/lib/format";
import { pca } from "@/lib/projection/pca";

type Model = "gemini" | "local";
type Projection = "umap" | "pca";

export type ExplorerInitial = { q?: string; model?: string; dims?: number; proj?: string };

const K = 5;
const SERIES = 8;
const W = 1000;
const H = 620;
const PAD = 36;

type Layout = {
  key: string;
  coords: [number, number][];
  /** Where the query landed, if there was one. */
  star: [number, number] | null;
  /** PCA only: share of variance the two axes keep. */
  explained?: number[];
  ms: number;
};

type QueryVector = { text: string; model: Model; vector: number[]; ms: number; cached: boolean };

// A seeded generator, so UMAP draws the same picture for the same data.
// Math.random would give a new layout on every render.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The first `dims` numbers of a longer Gemini vector; a no-op at full length. */
function atDims(v: number[], dims: number) {
  return dims < v.length ? truncateVector(v, dims) : v;
}

function project(
  vectors: number[][],
  projection: Projection,
  query: number[] | null,
): Omit<Layout, "key"> {
  const t0 = performance.now();
  if (projection === "pca") {
    // The axes come from the chunks alone; the query is projected onto them,
    // exactly, like any other vector.
    const p = pca(vectors, 2);
    return {
      coords: p.points as [number, number][],
      star: query ? (p.project(query) as [number, number]) : null,
      explained: p.explained,
      ms: Math.round(performance.now() - t0),
    };
  }
  const umap = new UMAP({
    nComponents: 2,
    // A point's 15 nearest neighbours decide where it sits. With 64 chunks
    // that is about a quarter of the library, so documents blend at the edges.
    nNeighbors: Math.min(15, vectors.length - 1),
    minDist: 0.1,
    random: mulberry32(42),
  });
  // UMAP is refitted with the query as one more point. umap-js also has
  // transform(), which places a new point without moving the others, but on
  // our chunks it put the query next to none of its 5 true neighbours in two
  // of four test questions (refitting: 2, 2, 5 and 5 of 5).
  const fitted = umap.fit(query ? [...vectors, query] : vectors) as [number, number][];
  return {
    coords: fitted.slice(0, vectors.length),
    star: query ? fitted[vectors.length] : null,
    ms: Math.round(performance.now() - t0),
  };
}

export function EmbeddingExplorer({ initial }: { initial: ExplorerInitial }) {
  const [model, setModel] = useState<Model>(initial.model === "local" ? "local" : "gemini");
  const [dims, setDims] = useState(initial.dims === 256 ? 256 : 768);
  const [projection, setProjection] = useState<Projection>(initial.proj === "pca" ? "pca" : "umap");
  const [data, setData] = useState<Partial<Record<Model, ChunkPoint[]>>>({});
  const [layout, setLayout] = useState<Layout | null>(null);
  const [query, setQuery] = useState(initial.q ?? "");
  const [queryVector, setQueryVector] = useState<QueryVector | null>(null);
  const [embedding, setEmbedding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [focusDoc, setFocusDoc] = useState<string | null>(null);

  const points = data[model];
  const effectiveDims = model === "local" ? 384 : dims;
  // A query embedded with one model means nothing in the other's space.
  const queryText = queryVector?.model === model ? queryVector.text : "";
  const layoutKey = `${model}:${effectiveDims}:${projection}:${points?.length ?? 0}:${queryText}`;

  // The vectors the plot and the neighbour search use. 256 dims is the first
  // 256 numbers of each stored 768-dim Gemini vector, renormalised.
  const vectors = useMemo(
    () => points?.map((p) => atDims(p.vector, effectiveDims)),
    [points, effectiveDims],
  );
  const q = useMemo(
    () => (queryVector?.model === model ? atDims(queryVector.vector, effectiveDims) : null),
    [queryVector, model, effectiveDims],
  );

  // Fixed colour per document: sorted by title, so a document keeps its hue
  // whichever model or projection is shown.
  const docs = useMemo(() => {
    const byId = new Map<string, string>();
    for (const p of points ?? []) byId.set(p.documentId, p.title);
    return [...byId.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, title], i) => ({ id, title, color: `var(--series-${(i % SERIES) + 1})` }));
  }, [points]);
  const colorOf = useMemo(() => new Map(docs.map((d) => [d.id, d.color])), [docs]);

  useEffect(() => {
    if (data[model]) return;
    fetch(`/api/embeddings?model=${model}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData((d) => ({ ...d, [model]: json.points }));
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [model, data]);

  // UMAP blocks the main thread for ~300 ms, so it runs after the paint that
  // shows "Projecting…" rather than during render.
  useEffect(() => {
    if (!vectors?.length || layout?.key === layoutKey) return;
    const timer = setTimeout(() => {
      setLayout({ key: layoutKey, ...project(vectors, projection, q) });
    }, 20);
    return () => clearTimeout(timer);
  }, [vectors, projection, q, layoutKey, layout?.key]);

  async function embedQuery(text: string, forModel: Model) {
    setEmbedding(true);
    setError(null);
    try {
      const res = await fetch("/api/embeddings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ texts: [text], model: forModel, task: "query" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setQueryVector({
        text,
        model: forModel,
        vector: json.vectors[0],
        ms: json.ms,
        cached: json.cached > 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setEmbedding(false);
    }
  }

  // Switching model re-embeds the same text in the new model's space.
  useEffect(() => {
    if (!queryVector || queryVector.model === model) return;
    const text = queryVector.text;
    const timer = setTimeout(() => embedQuery(text, model), 0);
    return () => clearTimeout(timer);
  }, [model, queryVector]);

  // Pre-loaded from a lesson's "Try it" link.
  useEffect(() => {
    if (!initial.q) return;
    const timer = setTimeout(() => embedQuery(initial.q!, model), 0);
    return () => clearTimeout(timer);
    // Only on first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ready = layout && layout.key === layoutKey && vectors && points;
  const neighbours: Neighbour[] = useMemo(
    () => (q && vectors ? nearest(q, vectors, K) : []),
    [q, vectors],
  );
  const star = ready ? layout.star : null;
  const near2d = star && ready ? nearest2d(star, layout.coords, K) : [];
  const agree = neighbours.filter((n) => near2d.includes(n.index)).length;

  // Fit every dot (and the star) into the SVG with a margin.
  const scale = useMemo(() => {
    if (!ready) return null;
    const all = star ? [...layout.coords, star] : layout.coords;
    const xs = all.map((c) => c[0]);
    const ys = all.map((c) => c[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const s = Math.min((W - 2 * PAD) / (x1 - x0 || 1), (H - 2 * PAD) / (y1 - y0 || 1));
    const ox = (W - s * (x1 - x0)) / 2;
    const oy = (H - s * (y1 - y0)) / 2;
    return (c: [number, number]) => [ox + (c[0] - x0) * s, H - (oy + (c[1] - y0) * s)] as const;
  }, [ready, layout, star]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) embedQuery(query.trim(), model);
  }

  const hoveredPoint = hovered != null && points ? points[hovered] : null;
  const neighbourSet = new Set(neighbours.map((n) => n.index));

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submit} className="flex flex-col gap-4 rounded-lg border p-4">
        <div className="flex gap-2">
          <Input
            aria-label="Query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a question to drop it on the map, e.g. What does the reranker add?"
          />
          <Button type="submit" disabled={embedding || !query.trim()}>
            {embedding ? "Embedding…" : "Place query"}
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <Field id="emb-model" label="Embedding model">
            <NativeSelect
              id="emb-model"
              value={model}
              onChange={(e) => setModel(e.target.value as Model)}
            >
              <NativeSelectOption value="gemini">Gemini Embedding 001</NativeSelectOption>
              <NativeSelectOption value="local">all-MiniLM-L6-v2, local (384)</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field id="emb-dims" label="Dimensions">
            <NativeSelect
              id="emb-dims"
              value={effectiveDims}
              disabled={model === "local"}
              onChange={(e) => setDims(Number(e.target.value))}
            >
              {model === "local" ? (
                <NativeSelectOption value={384}>384 (fixed)</NativeSelectOption>
              ) : (
                <>
                  <NativeSelectOption value={768}>768 (stored)</NativeSelectOption>
                  <NativeSelectOption value={256}>256 (first 256, renormalised)</NativeSelectOption>
                </>
              )}
            </NativeSelect>
          </Field>
          <Field id="emb-proj" label="Projection">
            <NativeSelect
              id="emb-proj"
              value={projection}
              onChange={(e) => setProjection(e.target.value as Projection)}
            >
              <NativeSelectOption value="umap">UMAP (non-linear)</NativeSelectOption>
              <NativeSelectOption value="pca">PCA (linear)</NativeSelectOption>
            </NativeSelect>
          </Field>
          <p className="text-muted-foreground pb-1 text-xs">
            {!points
              ? "Loading vectors…"
              : !ready
                ? "Projecting…"
                : `${points.length} chunks · ${effectiveDims} dims → 2D in ${formatMs(layout.ms)}${
                    layout.explained
                      ? ` · the two axes keep ${(100 * (layout.explained[0] + layout.explained[1])).toFixed(1)}% of the variance`
                      : ""
                  }`}
          </p>
        </div>
      </form>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="relative rounded-lg border">
          {/* Legend: click a document to highlight it; identity never rests on colour alone. */}
          <div className="flex flex-wrap gap-1.5 border-b p-3">
            {docs.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setFocusDoc((f) => (f === d.id ? null : d.id))}
                aria-pressed={focusDoc === d.id}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs ${
                  focusDoc && focusDoc !== d.id ? "opacity-40" : ""
                } ${focusDoc === d.id ? "bg-muted" : ""}`}
              >
                <span className="size-2.5 rounded-full" style={{ background: d.color }} />
                {d.title}
              </button>
            ))}
          </div>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full"
            role="img"
            aria-label={`Scatter plot of ${points?.length ?? 0} chunks projected to 2D`}
            onMouseLeave={() => setHovered(null)}
          >
            {ready && scale && (
              <>
                {star &&
                  neighbours.map((n) => {
                    const [x1, y1] = scale(star);
                    const [x2, y2] = scale(layout.coords[n.index]);
                    return (
                      <line
                        key={n.index}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="currentColor"
                        strokeOpacity={0.5}
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                      />
                    );
                  })}
                {layout.coords.map((c, i) => {
                  const [x, y] = scale(c);
                  const p = points[i];
                  const dim = focusDoc && focusDoc !== p.documentId;
                  return (
                    <g key={p.chunkId} onMouseEnter={() => setHovered(i)}>
                      {/* A bigger invisible target than the dot itself. */}
                      <circle cx={x} cy={y} r={12} fill="transparent" />
                      <circle
                        cx={x}
                        cy={y}
                        r={neighbourSet.has(i) || hovered === i ? 8 : 6}
                        fill={colorOf.get(p.documentId)}
                        fillOpacity={dim ? 0.12 : 0.9}
                        stroke="var(--background)"
                        strokeWidth={2}
                      />
                    </g>
                  );
                })}
                {star && <Star at={scale(star)} />}
              </>
            )}
          </svg>
          {hoveredPoint && ready && scale && (
            <HoverCard
              point={hoveredPoint}
              color={colorOf.get(hoveredPoint.documentId)}
              at={scale(layout.coords[hovered!])}
              similarity={q ? nearest(q, [vectors[hovered!]], 1)[0].similarity : null}
            />
          )}
        </div>

        <aside className="flex flex-col gap-3 rounded-lg border p-4 text-sm">
          <h2 className="font-medium">Nearest {K} chunks</h2>
          {!queryVector ? (
            <p className="text-muted-foreground">
              Place a query to see its {K} nearest chunks by cosine similarity in all{" "}
              {effectiveDims} dimensions, linked to the star with dashed lines.
            </p>
          ) : !star ? (
            <p className="text-muted-foreground">Embedding…</p>
          ) : (
            <>
              <p className="text-muted-foreground text-xs">
                “{queryVector.text}” embedded in {formatMs(queryVector.ms)}
                {queryVector.cached ? " (cached)" : ""}.
              </p>
              <ol className="flex flex-col gap-2">
                {neighbours.map((n, rank) => {
                  const p = points![n.index];
                  return (
                    <li
                      key={p.chunkId}
                      className="flex gap-2"
                      onMouseEnter={() => setHovered(n.index)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      <span className="text-muted-foreground w-4 tabular-nums">{rank + 1}</span>
                      <span
                        className="mt-1.5 size-2.5 shrink-0 rounded-full"
                        style={{ background: colorOf.get(p.documentId) }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">
                          {p.title} #{p.ordinal}
                        </span>
                        <span className="text-muted-foreground text-xs tabular-nums">
                          cosine {n.similarity.toFixed(3)}
                          {near2d.includes(n.index) ? "" : " · not in the 2D top 5"}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
              <div className="flex items-center gap-2">
                <Badge variant={agree === K ? "secondary" : "outline"}>
                  {agree} of {K}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  of the true nearest chunks are also the {K} closest dots on the map.
                </span>
              </div>
            </>
          )}
          <p className="text-muted-foreground mt-auto border-t pt-3 text-xs">
            {projection === "umap"
              ? "UMAP is re-run with the query as one more point, so the map shifts a little per query. It keeps each point's neighbourhood but not global distances: gaps between clusters, and cluster sizes, mean little."
              : "PCA is a flat shadow of the cloud along its two widest directions. Distances are honest along those axes, and everything else is squashed."}
          </p>
        </aside>
      </div>

      {ready && (
        <details className="rounded-lg border p-4 text-sm">
          <summary className="cursor-pointer font-medium">Table view</summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs tabular-nums">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1 pr-4 font-normal">Document</th>
                  <th className="py-1 pr-4 font-normal">Chunk</th>
                  <th className="py-1 pr-4 font-normal">Tokens</th>
                  <th className="py-1 pr-4 font-normal">x</th>
                  <th className="py-1 pr-4 font-normal">y</th>
                  {q && <th className="py-1 font-normal">Cosine to query</th>}
                </tr>
              </thead>
              <tbody>
                {points.map((p, i) => (
                  <tr key={p.chunkId} className="border-t">
                    <td className="py-1 pr-4">{p.title}</td>
                    <td className="py-1 pr-4">#{p.ordinal}</td>
                    <td className="py-1 pr-4">{p.tokenCount}</td>
                    <td className="py-1 pr-4">{layout.coords[i][0].toFixed(2)}</td>
                    <td className="py-1 pr-4">{layout.coords[i][1].toFixed(2)}</td>
                    {q && (
                      <td className="py-1">
                        {nearest(q, [vectors[i]], 1)[0].similarity.toFixed(3)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}

function Star({ at: [cx, cy] }: { at: readonly [number, number] }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? 14 : 6;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(" ");
  return (
    <polygon
      points={pts}
      fill="var(--foreground)"
      stroke="var(--background)"
      strokeWidth={2}
      aria-label="Query"
    />
  );
}

function HoverCard({
  point,
  color,
  at: [x, y],
  similarity,
}: {
  point: ChunkPoint;
  color?: string;
  at: readonly [number, number];
  similarity: number | null;
}) {
  // Positioned in SVG units, converted to percentages of the plot.
  const left = (x / W) * 100;
  const top = (y / H) * 100;
  return (
    <div
      className="bg-popover text-popover-foreground pointer-events-none absolute z-10 w-72 rounded-md border p-3 text-xs shadow-md"
      style={{
        left: `${left}%`,
        top: `calc(${top}% + 3rem)`,
        transform: `translate(${left > 60 ? "-105%" : "5%"}, ${top > 60 ? "-105%" : "5%"})`,
      }}
    >
      <p className="flex items-center gap-1.5 font-medium">
        <span className="size-2.5 rounded-full" style={{ background: color }} />
        {point.title} #{point.ordinal}
      </p>
      <p className="text-muted-foreground mt-1 tabular-nums">
        {point.tokenCount} tokens
        {similarity != null ? ` · cosine to query ${similarity.toFixed(3)}` : ""}
      </p>
      <p className="mt-2 line-clamp-5">{point.preview}</p>
    </div>
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
