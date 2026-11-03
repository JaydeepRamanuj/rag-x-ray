/**
 * Small SVG pieces the lesson diagrams are drawn with. Diagrams are 720 units
 * wide, the lesson column's width, so 13 units of text is 13px on a desktop.
 * Colours are the app's --series-* tokens; nothing here uses ids (no
 * <marker>s), so a diagram can appear twice on a page (inline and full size).
 */

export type Tone = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | "neutral";

export const W = 720;

export function ink(tone: Tone) {
  return tone === "neutral" ? "var(--muted-foreground)" : `var(--series-${tone})`;
}

export function wash(tone: Tone, percent = 12) {
  return `color-mix(in oklch, ${ink(tone)} ${percent}%, var(--background))`;
}

export function Svg({ height, children }: { height: number; children: React.ReactNode }) {
  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      className="block h-auto w-full font-sans"
      fontSize={13}
      aria-hidden
    >
      {children}
    </svg>
  );
}

type TextProps = {
  x: number;
  y: number;
  children: React.ReactNode;
  anchor?: "start" | "middle" | "end";
  size?: number;
  weight?: number;
  muted?: boolean;
  tone?: Tone;
  mono?: boolean;
};

export function Text({
  x,
  y,
  children,
  anchor = "start",
  size,
  weight,
  muted,
  tone,
  mono,
}: TextProps) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={size}
      fontWeight={weight}
      fontFamily={mono ? "var(--font-mono)" : undefined}
      fill={tone ? ink(tone) : muted ? "var(--muted-foreground)" : "var(--foreground)"}
    >
      {children}
    </text>
  );
}

/** A rounded box with a bold title and up to two smaller lines under it. */
export function Box({
  x,
  y,
  w,
  h,
  tone = "neutral",
  title,
  sub,
  dashed,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  tone?: Tone;
  title?: string;
  sub?: string | string[];
  dashed?: boolean;
}) {
  const lines = sub === undefined ? [] : Array.isArray(sub) ? sub : [sub];
  // Centre the title and its sub-lines as one block.
  const block = (title ? 15 : 0) + lines.length * 14;
  const top = y + (h - block) / 2;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={8}
        fill={wash(tone)}
        stroke={ink(tone)}
        strokeWidth={1.25}
        strokeDasharray={dashed ? "4 3" : undefined}
      />
      {title && (
        <Text x={x + w / 2} y={top + 11} anchor="middle" weight={600}>
          {title}
        </Text>
      )}
      {lines.map((line, i) => (
        <Text
          key={i}
          x={x + w / 2}
          y={top + (title ? 15 : 0) + 11 + i * 14}
          anchor="middle"
          size={11.5}
          muted
        >
          {line}
        </Text>
      ))}
    </g>
  );
}

type Point = readonly [number, number];

/** A line through `points` with an arrowhead at the end (and the start, if `both`). */
export function Arrow({
  points,
  tone = "neutral",
  both,
  dashed,
}: {
  points: readonly Point[];
  tone?: Tone;
  both?: boolean;
  dashed?: boolean;
}) {
  const colour = ink(tone);
  return (
    <g>
      <polyline
        points={points.map((p) => p.join(",")).join(" ")}
        fill="none"
        stroke={colour}
        strokeWidth={1.5}
        strokeDasharray={dashed ? "4 3" : undefined}
      />
      <Head from={points[points.length - 2]} to={points[points.length - 1]} colour={colour} />
      {both && <Head from={points[1]} to={points[0]} colour={colour} />}
    </g>
  );
}

function Head({ from, to, colour }: { from: Point; to: Point; colour: string }) {
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const size = 7;
  const spread = 0.45;
  const a: Point = [
    to[0] - size * Math.cos(angle - spread),
    to[1] - size * Math.sin(angle - spread),
  ];
  const b: Point = [
    to[0] - size * Math.cos(angle + spread),
    to[1] - size * Math.sin(angle + spread),
  ];
  return <polygon points={`${to.join(",")} ${a.join(",")} ${b.join(",")}`} fill={colour} />;
}

/** Evenly spaced columns: the x of column i when `count` boxes of width `w` fill the diagram. */
export function columns(count: number, w: number, width = W, left = 0) {
  const gap = (width - count * w) / (count - 1);
  return (i: number) => left + i * (w + gap);
}
