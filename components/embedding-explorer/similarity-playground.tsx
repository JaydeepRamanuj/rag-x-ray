"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cosineSimilarity, truncateVector } from "@/lib/embeddings/vector-math";

// Each pair isolates one thing embeddings are good or bad at.
const PRESETS: { label: string; a: string; b: string }[] = [
  { label: "Synonyms", a: "The car is very fast.", b: "The automobile is extremely quick." },
  {
    label: "Negation",
    a: "This medicine is safe for children.",
    b: "This medicine is not safe for children.",
  },
  { label: "Word order", a: "The dog bit the man.", b: "The man bit the dog." },
  { label: "Spanish", a: "Where is the train station?", b: "¿Dónde está la estación de tren?" },
  { label: "Hindi", a: "Where is the train station?", b: "रेलवे स्टेशन कहाँ है?" },
  { label: "Same word", a: "I deposited cash at the bank.", b: "We sat on the river bank." },
  { label: "Unrelated", a: "The car is very fast.", b: "Photosynthesis happens in chloroplasts." },
];

type Score = { label: string; note: string; value: number };

async function embedPair(a: string, b: string, model: "gemini" | "local") {
  const res = await fetch("/api/embeddings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    // SEMANTIC_SIMILARITY embeds both sides the same way; RETRIEVAL_QUERY
    // and RETRIEVAL_DOCUMENT would treat them as a question and an answer.
    body: JSON.stringify({ texts: [a, b], model, task: "similarity" }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? res.statusText);
  return json.vectors as [number[], number[]];
}

export function SimilarityPlayground() {
  const [a, setA] = useState(PRESETS[1].a);
  const [b, setB] = useState(PRESETS[1].b);
  const [scores, setScores] = useState<Score[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function compare(left = a, right = b) {
    if (!left.trim() || !right.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const [[g1, g2], [l1, l2]] = await Promise.all([
        embedPair(left, right, "gemini"),
        embedPair(left, right, "local"),
      ]);
      setScores([
        { label: "Gemini, 768 dims", note: "", value: cosineSimilarity(g1, g2) },
        {
          label: "Gemini, 256 dims",
          note: "first 256 of the same vectors",
          value: cosineSimilarity(truncateVector(g1, 256), truncateVector(g2, 256)),
        },
        { label: "all-MiniLM-L6-v2, 384 dims", note: "local", value: cosineSimilarity(l1, l2) },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <header className="flex flex-col gap-1">
        <h2 className="font-medium">Similarity playground</h2>
        <p className="text-muted-foreground text-sm">
          Two sentences, one cosine similarity per model. Scores only compare within a model: try{" "}
          <em>Unrelated</em> first to see where each model&apos;s floor is.
        </p>
      </header>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <Button
            key={p.label}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setA(p.a);
              setB(p.b);
              compare(p.a, p.b);
            }}
          >
            {p.label}
          </Button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sim-a">Sentence A</Label>
          <Textarea id="sim-a" rows={2} value={a} onChange={(e) => setA(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sim-b">Sentence B</Label>
          <Textarea id="sim-b" rows={2} value={b} onChange={(e) => setB(e.target.value)} />
        </div>
      </div>
      <div>
        <Button type="button" onClick={() => compare()} disabled={loading}>
          {loading ? "Embedding…" : "Compare"}
        </Button>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      {scores && (
        <ul className="flex flex-col gap-2 text-sm">
          {scores.map((s) => (
            <li
              key={s.label}
              className="grid grid-cols-[minmax(0,14rem)_minmax(0,1fr)_4rem] items-center gap-3"
            >
              <span>
                {s.label}
                {s.note && <span className="text-muted-foreground block text-xs">{s.note}</span>}
              </span>
              {/* The bar runs from 0 to 1; negative scores (rare) show as empty. */}
              <span className="bg-muted h-2 overflow-hidden rounded-full">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${Math.max(0, s.value) * 100}%`,
                    background: "var(--series-1)",
                  }}
                />
              </span>
              <span className="text-right tabular-nums">{s.value.toFixed(3)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
