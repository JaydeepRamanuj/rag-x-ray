import { Arrow, ink, Svg, Text, wash } from "./kit";

// Left panel: 18 points, the number of chunks in Lesson 6's EXPLAIN ANALYZE.
const query = [170, 150] as const;
const points: (readonly [number, number])[] = [
  [40, 70],
  [85, 52],
  [140, 64],
  [225, 58],
  [290, 80],
  [60, 130],
  [120, 118],
  [205, 118],
  [250, 140],
  [305, 150],
  [30, 200],
  [95, 178],
  [150, 196],
  [196, 175],
  [262, 205],
  [70, 236],
  [180, 240],
  [300, 232],
];
const nearest = new Set(
  points
    .map((p, i) => ({ i, d: Math.hypot(p[0] - query[0], p[1] - query[1]) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 5)
    .map((p) => p.i),
);

// Right panel: the same vectors appear on every layer they reach. Layer 0
// holds them all; each layer up keeps a sparser subset with longer links.
const L0 = [392, 414, 438, 460, 486, 508, 532, 556, 580, 603, 622, 642, 660, 684, 706];
const layers = [
  { y: 228, xs: L0 },
  { y: 152, xs: [414, 486, 556, 603, 642, 684] },
  { y: 76, xs: [414, 603] },
];
const QX = 655;
// Greedy search: on each layer, hop to whichever neighbour is closer to the
// query, then drop down from where it stopped.
const path: { layer: number; from: number; to: number }[] = [
  { layer: 2, from: 414, to: 603 },
  { layer: 1, from: 603, to: 642 },
  { layer: 0, from: 642, to: 660 },
];

/** Vector databases: exact search compares every row; HNSW hops down a layered graph. */
export function ExactVsHnswDiagram() {
  return (
    <Svg height={270}>
      <Text x={0} y={18} weight={600}>
        Exact search
      </Text>
      <Text x={0} y={34} size={11.5} muted>
        compare the query with every row
      </Text>
      {points.map((p, i) => (
        <line
          key={`l${i}`}
          x1={query[0]}
          y1={query[1]}
          x2={p[0]}
          y2={p[1]}
          stroke="var(--border)"
        />
      ))}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p[0]}
          cy={p[1]}
          r={6}
          fill={nearest.has(i) ? wash(3, 60) : wash("neutral", 15)}
          stroke={nearest.has(i) ? ink(3) : ink("neutral")}
        />
      ))}
      <Star x={query[0]} y={query[1]} />
      <Text x={0} y={264} size={11.5} muted>
        18 chunks: every distance computed, top 5 in green
      </Text>

      <line x1={350} x2={350} y1={10} y2={260} stroke="var(--border)" />

      <Text x={378} y={18} weight={600}>
        HNSW index
      </Text>
      <Text x={378} y={34} size={11.5} muted>
        hop greedily toward the query, then drop a layer
      </Text>
      <line x1={QX} x2={QX} y1={56} y2={240} stroke={ink(2)} strokeDasharray="3 3" />
      <Text x={QX} y={52} anchor="middle" size={11} tone={2}>
        query
      </Text>
      {layers.map((layer, li) => (
        <g key={li}>
          <Text x={720} y={layer.y + 22} anchor="end" size={11} muted>
            {li === 0 ? "layer 0: every vector" : `layer ${li}`}
          </Text>
          {layer.xs.slice(1).map((xv, i) => (
            <line
              key={i}
              x1={layer.xs[i]}
              x2={xv}
              y1={layer.y}
              y2={layer.y}
              stroke={ink("neutral")}
              strokeWidth={1}
            />
          ))}
          {layer.xs.map((xv) => (
            <circle
              key={xv}
              cx={xv}
              cy={layer.y}
              r={5}
              fill={wash("neutral", 15)}
              stroke={ink("neutral")}
            />
          ))}
        </g>
      ))}
      {path.map((step, i) => {
        const y = layers[step.layer].y;
        return (
          <g key={i}>
            <Arrow
              points={[
                [step.from, y - 10],
                [step.to, y - 10],
              ]}
              tone={7}
            />
            {step.layer > 0 && (
              <Arrow
                points={[
                  [step.to, y + 6],
                  [step.to, layers[step.layer - 1].y - 7],
                ]}
                tone={7}
                dashed
              />
            )}
          </g>
        );
      })}
      <circle cx={layers[2].xs[0]} cy={layers[2].y} r={6} fill={wash(7, 50)} stroke={ink(7)} />
      <Text x={layers[2].xs[0]} y={layers[2].y + 20} anchor="middle" size={11} tone={7}>
        entry
      </Text>
      <circle cx={660} cy={layers[0].y} r={6} fill={wash(3, 60)} stroke={ink(3)} />
    </Svg>
  );
}

function Star({ x, y }: { x: number; y: number }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? 10 : 4.5;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    return `${x + r * Math.cos(a)},${y + r * Math.sin(a)}`;
  }).join(" ");
  return <polygon points={pts} fill={ink(2)} />;
}
