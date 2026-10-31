export function formatMs(ms: number | null | undefined): string {
  if (ms == null) return "–";
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s`;
}

/** Costs here are tiny, so show enough digits to see they aren't zero. */
export function formatUsd(usd: number | null | undefined): string {
  if (usd == null) return "–";
  if (usd === 0) return "$0";
  return usd < 0.01 ? `$${usd.toFixed(6)}` : `$${usd.toFixed(4)}`;
}

export function formatInt(n: number | null | undefined): string {
  return n == null ? "–" : n.toLocaleString("en-US");
}
