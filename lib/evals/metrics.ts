/**
 * Retrieval metrics for eval runs. Pure functions, so they're unit-tested
 * and need no LLM calls.
 *
 * An eval item stores the passage that answers it as text, not a chunk id,
 * so the set survives re-chunking. A chunk counts as a hit when it contains
 * most of that passage, measured on word trigrams so that a chunk boundary,
 * markdown punctuation or different whitespace don't break the match.
 */

/** Share of the source's trigrams a chunk must contain to count as a hit. */
export const HIT_THRESHOLD = 0.6;

const SHINGLE = 3;

/** Lowercase words with punctuation and markdown removed. */
export function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function shingles(ws: string[], n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i + n <= ws.length; i++) out.push(ws.slice(i, i + n).join(" "));
  return out;
}

/** Fraction (0–1) of the source passage's trigrams that appear in the chunk. */
export function sourceCoverage(chunk: string, source: string): number {
  const sourceWords = words(source);
  // A passage shorter than one trigram is compared with shorter shingles.
  const n = Math.min(SHINGLE, sourceWords.length);
  if (n === 0) return 0;
  const wanted = shingles(sourceWords, n);
  const have = new Set(shingles(words(chunk), n));
  return wanted.filter((s) => have.has(s)).length / wanted.length;
}

export function isHit(chunk: string, source: string, threshold = HIT_THRESHOLD): boolean {
  return sourceCoverage(chunk, source) >= threshold;
}

/** 1-based rank of the first retrieved chunk that holds the source, or null. */
export function firstHitRank(chunks: string[], source: string): number | null {
  const i = chunks.findIndex((c) => isHit(c, source));
  return i === -1 ? null : i + 1;
}

/** 1 for rank 1, 0.5 for rank 2, ... and 0 for a miss. */
export function reciprocalRank(rank: number | null): number {
  return rank ? 1 / rank : 0;
}

export function mean(values: number[]): number | null {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
}

export type ScoredItem = {
  hitRank: number | null;
  /** 1–5 from the judge; absent in retrieval-only runs or when judging failed. */
  faithfulness?: number | null;
  relevance?: number | null;
};

export type RunScores = {
  hitRate: number | null;
  mrr: number | null;
  faithfulness: number | null;
  answerRelevance: number | null;
};

/**
 * Hit rate@k is the share of questions with a hit anywhere in the top k;
 * MRR also rewards putting it first. Judge scores average only the items
 * that were actually judged.
 */
export function summarize(items: ScoredItem[]): RunScores {
  const judged = (key: "faithfulness" | "relevance") =>
    mean(items.map((i) => i[key]).filter((v): v is number => typeof v === "number"));
  return {
    hitRate: mean(items.map((i) => (i.hitRank ? 1 : 0))),
    mrr: mean(items.map((i) => reciprocalRank(i.hitRank))),
    faithfulness: judged("faithfulness"),
    answerRelevance: judged("relevance"),
  };
}

export type ItemChange = "fixed" | "broke" | "better" | "worse" | "same";

/** How one question's retrieval moved between two runs, for the compare view. */
export function compareRank(before: number | null, after: number | null): ItemChange {
  if (!before && after) return "fixed";
  if (before && !after) return "broke";
  if (before && after && after < before) return "better";
  if (before && after && after > before) return "worse";
  return "same";
}

type Judged = { itemId: string; faithfulness?: number | null; relevance?: number | null };

function isJudged(i: Judged): boolean {
  return typeof i.faithfulness === "number" || typeof i.relevance === "number";
}

export function judgedCount(items: Judged[]): number {
  return items.filter(isJudged).length;
}

/**
 * Judge averages for two runs over only the questions judged in both. When
 * one run's judge calls failed partway, comparing its average over 5
 * answers with another's over 25 would compare different questions.
 */
export function pairedJudgeScores(a: Judged[], b: Judged[]) {
  const inB = new Map(b.filter(isJudged).map((i) => [i.itemId, i]));
  const pairs = a.filter(isJudged).flatMap((i) => {
    const other = inB.get(i.itemId);
    return other ? [[i, other] as const] : [];
  });
  const avg = (side: 0 | 1, key: "faithfulness" | "relevance") =>
    mean(pairs.map((p) => p[side][key]).filter((v): v is number => typeof v === "number"));
  return {
    count: pairs.length,
    faithfulness: [avg(0, "faithfulness"), avg(1, "faithfulness")] as const,
    relevance: [avg(0, "relevance"), avg(1, "relevance")] as const,
  };
}
