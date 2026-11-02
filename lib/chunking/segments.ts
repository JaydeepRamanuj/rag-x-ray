export type Segment = {
  start: number;
  end: number;
  /** The first chunk covering this stretch, or null for text between chunks. */
  chunk: number | null;
  /** How many chunks cover it: 2 or more is overlap. */
  cover: number;
};

/**
 * Cuts a text into stretches that are covered by the same chunks, so the
 * lab can colour each chunk and darken the overlaps. A sweep over every
 * chunk start and end: between two neighbouring points, coverage can't change.
 */
export function segmentsFor(
  length: number,
  chunks: { startChar: number; endChar: number }[],
): Segment[] {
  const points = new Set([0, length]);
  for (const c of chunks) {
    points.add(c.startChar);
    points.add(c.endChar);
  }
  const sorted = [...points].filter((p) => p >= 0 && p <= length).sort((a, b) => a - b);
  const out: Segment[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    let first: number | null = null;
    let cover = 0;
    chunks.forEach((c, k) => {
      if (c.startChar <= start && c.endChar >= end) {
        cover++;
        first ??= k;
      }
    });
    out.push({ start, end, chunk: first, cover });
  }
  return out;
}

/** True when a cut at `at` splits a word: letters or digits on both sides. */
export function cutsWord(text: string, at: number): boolean {
  if (at <= 0 || at >= text.length) return false;
  return /[\p{L}\p{N}]/u.test(text[at - 1]) && /[\p{L}\p{N}]/u.test(text[at]);
}
