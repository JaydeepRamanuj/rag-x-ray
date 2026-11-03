import { defaults } from "@/lib/config";

import { Arrow, ink, Svg, Text, wash, type Tone } from "./kit";

const K = defaults.rrfK;

// Made-up chunks, real arithmetic: the same formula as reciprocalRankFusion().
const vector = ["C", "A", "D", "B"];
const keyword = ["A", "E", "C", "F"];
const tone: Record<string, Tone> = { A: 1, B: 5, C: 3, D: 4, E: 7, F: 8 };

const fused = [...new Set([...vector, ...keyword])]
  .map((id) => {
    const v = vector.indexOf(id) + 1;
    const k = keyword.indexOf(id) + 1;
    const parts = [v, k].filter((r) => r > 0);
    return {
      id,
      ranks: [v && `V${v}`, k && `K${k}`].filter(Boolean).join(" · "),
      formula: parts.map((r) => `1/${K + r}`).join(" + "),
      score: parts.reduce((s, r) => s + 1 / (K + r), 0),
    };
  })
  .sort((a, b) => b.score - a.score);

const ROW_H = 34;
const TOP = 50;
const rowY = (i: number) => TOP + i * ROW_H;

function Chip({ x, y, id }: { x: number; y: number; id: string }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={26}
        height={24}
        rx={5}
        fill={wash(tone[id], 30)}
        stroke={ink(tone[id])}
      />
      <Text x={x + 13} y={y + 16.5} anchor="middle" weight={600}>
        {id}
      </Text>
    </g>
  );
}

function List({ x, title, sub, ids }: { x: number; title: string; sub: string; ids: string[] }) {
  return (
    <g>
      <Text x={x} y={16} weight={600}>
        {title}
      </Text>
      <Text x={x} y={32} size={11.5} muted>
        {sub}
      </Text>
      {ids.map((id, i) => (
        <g key={id}>
          <Text x={x + 10} y={rowY(i) + 17} anchor="end" size={12} muted>
            {i + 1}
          </Text>
          <Chip x={x + 18} y={rowY(i)} id={id} />
          <Text x={x + 52} y={rowY(i) + 17} size={11.5} muted>
            {`1/${K + i + 1}`}
          </Text>
        </g>
      ))}
    </g>
  );
}

/** Hybrid retrieval: two ranked lists merged by reciprocal rank fusion. */
export function RrfDiagram() {
  return (
    <Svg height={TOP + fused.length * ROW_H + 6}>
      <List x={0} title="Vector search" sub="meaning" ids={vector} />
      <List x={150} title="Keyword search" sub="exact words" ids={keyword} />

      <Arrow
        points={[
          [278, TOP + 60],
          [318, TOP + 60],
        ]}
        tone="neutral"
      />

      <Text x={340} y={16} weight={600}>
        {`RRF, k = ${K}: add up 1 / (k + rank)`}
      </Text>
      <Text x={340} y={32} size={11.5} muted>
        one list, ordered by the sum
      </Text>
      {fused.map((f, i) => (
        <g key={f.id}>
          <Text x={350} y={rowY(i) + 17} anchor="end" size={12} muted>
            {i + 1}
          </Text>
          <Chip x={358} y={rowY(i)} id={f.id} />
          <Text x={394} y={rowY(i) + 17} size={12}>
            {f.ranks}
          </Text>
          <Text x={470} y={rowY(i) + 17} size={11.5} muted>
            {f.formula}
          </Text>
          <Text x={720} y={rowY(i) + 17} anchor="end" weight={i < 2 ? 600 : undefined}>
            {f.score.toFixed(4)}
          </Text>
        </g>
      ))}
    </Svg>
  );
}
