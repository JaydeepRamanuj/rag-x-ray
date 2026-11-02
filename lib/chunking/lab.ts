import { estimateTokens } from "@/lib/tokens/count";

import { chunkText, STRATEGIES, type Chunk, type ChunkOutput, type Strategy } from "./index";
import { chunkStats, type ChunkStats } from "./stats";

export type LabStrategyResult =
  | ({ ok: true; ms: number; chunks: Chunk[]; stats: ChunkStats } & Pick<ChunkOutput, "semantic">)
  | { ok: false; error: string };

export type LabResult = {
  sourceTokens: number;
  strategies: Record<Strategy, LabStrategyResult>;
};

/** Overlap is set as a share of chunk size in the lab, stored in tokens. */
export function overlapTokens(chunkSize: number, overlapPct: number): number {
  return Math.min(chunkSize - 1, Math.round((chunkSize * overlapPct) / 100));
}

/**
 * All four strategies over one text with the same settings, each timed.
 * One failing (the local model can't load, say) doesn't hide the others.
 */
export async function runLab(
  text: string,
  settings: { chunkSize: number; overlapPct: number; threshold: number },
  embed: (texts: string[]) => Promise<number[][]>,
): Promise<LabResult> {
  const sourceTokens = estimateTokens(text);
  const overlap = overlapTokens(settings.chunkSize, settings.overlapPct);
  const entries = await Promise.all(
    STRATEGIES.map(async (strategy): Promise<[Strategy, LabStrategyResult]> => {
      const t0 = performance.now();
      try {
        const out = await chunkText(
          text,
          { strategy, chunkSize: settings.chunkSize, overlap, threshold: settings.threshold },
          embed,
        );
        return [
          strategy,
          {
            ok: true,
            ms: Math.round(performance.now() - t0),
            chunks: out.chunks,
            stats: chunkStats(text, out.chunks, sourceTokens),
            semantic: out.semantic,
          },
        ];
      } catch (err) {
        return [strategy, { ok: false, error: err instanceof Error ? err.message : String(err) }];
      }
    }),
  );
  return { sourceTokens, strategies: Object.fromEntries(entries) as LabResult["strategies"] };
}
