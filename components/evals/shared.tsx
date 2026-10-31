import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import type { ItemChange } from "@/lib/evals/metrics";

export function pct(v: number | null | undefined): string {
  return v == null ? "–" : `${Math.round(v * 100)}%`;
}

export function fixed2(v: number | null | undefined): string {
  return v == null ? "–" : v.toFixed(2);
}

/** Judge scores are 1–5. */
export function outOf5(v: number | null | undefined): string {
  return v == null ? "–" : `${v.toFixed(1)}/5`;
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Signed difference, so the compare view reads "+0.05" or "−0.04". */
export function delta(a: number | null, b: number | null, digits = 2): string {
  if (a == null || b == null) return "";
  const d = b - a;
  if (Math.abs(d) < 10 ** -digits / 2) return "±0";
  return `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(digits)}`;
}

export function RankBadge({ rank }: { rank: number | null }) {
  if (rank == null) return <Badge variant="destructive">miss</Badge>;
  return <Badge variant={rank === 1 ? "default" : "secondary"}>#{rank}</Badge>;
}

const CHANGE_STYLE: Record<ItemChange, "default" | "secondary" | "destructive" | "outline"> = {
  fixed: "default",
  better: "secondary",
  same: "outline",
  worse: "destructive",
  broke: "destructive",
};

export function ChangeBadge({ change }: { change: ItemChange }) {
  return <Badge variant={CHANGE_STYLE[change]}>{change}</Badge>;
}

export function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
