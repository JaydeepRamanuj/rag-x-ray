import { ink, Svg, Text, wash, type Tone } from "./kit";

// Lesson 13's trace, measured on 1 Nov 2026: the same question sent twice.
// Durations in ms, in the order they ran. Building the prompt took under 1 ms.
const stages: { label: string; tone: Tone }[] = [
  { label: "Embed question", tone: 1 },
  { label: "Search", tone: 7 },
  { label: "Rerank 20", tone: 4 },
  { label: "Model: first token", tone: "neutral" },
  { label: "Model: writing", tone: 3 },
];

const runs = [
  { name: "Cold cache", ms: [869, 557, 975, 766, 285], sourcesReady: 2401, done: 3459 },
  { name: "Cached", ms: [49, 341, 65, 792, 210], sourcesReady: 456, done: 1468 },
];

const LEFT = 110;
const RIGHT = 700;
const MAX = 3600;
const x = (ms: number) => LEFT + (ms / MAX) * (RIGHT - LEFT);
const BAR = 30;
const ROWS = [62, 144];
const AXIS = 206;

const legendX = [0, 120, 190, 270, 410];

/** Full pipeline: where the time went in one request, cold and cached. */
export function PipelineTimingDiagram() {
  return (
    <Svg height={232}>
      {stages.map((s, i) => (
        <g key={s.label}>
          <rect
            x={legendX[i]}
            y={4}
            width={12}
            height={12}
            rx={2}
            fill={wash(s.tone, 40)}
            stroke={ink(s.tone)}
          />
          <Text x={legendX[i] + 18} y={14} size={12}>
            {s.label}
          </Text>
        </g>
      ))}

      {runs.map((run, r) => {
        const y = ROWS[r];
        // Each stage starts where the previous ended; the model's first-token
        // wait starts at "sources ready", and writing ends at "done".
        const starts = [
          0,
          run.ms[0],
          run.ms[0] + run.ms[1],
          run.sourcesReady,
          run.sourcesReady + run.ms[3],
        ];
        const ends = [...starts.slice(1, 3), run.sourcesReady, starts[4], run.done];
        return (
          <g key={run.name}>
            <Text x={0} y={y + 13} weight={600}>
              {run.name}
            </Text>
            <Text x={0} y={y + 27} size={11.5} muted>
              done {run.done.toLocaleString("en")} ms
            </Text>
            {stages.map((s, i) => {
              const x0 = x(starts[i]);
              const w = x(ends[i]) - x0;
              const inside = w >= 44;
              return (
                <g key={s.label}>
                  <rect
                    x={x0}
                    y={y}
                    width={w}
                    height={BAR}
                    fill={wash(s.tone, 40)}
                    stroke={ink(s.tone)}
                    strokeWidth={1}
                  />
                  <Text
                    x={x0 + w / 2}
                    y={inside ? y + BAR / 2 + 4 : y + BAR + 13}
                    anchor="middle"
                    size={11}
                    muted={!inside}
                  >
                    {inside ? `${run.ms[i]} ms` : run.ms[i]}
                  </Text>
                </g>
              );
            })}
            <line
              x1={x(run.sourcesReady)}
              x2={x(run.sourcesReady)}
              y1={y - 14}
              y2={y + BAR + 2}
              stroke="var(--foreground)"
              strokeDasharray="3 2"
            />
            <Text x={x(run.sourcesReady)} y={y - 18} anchor="middle" size={11}>
              sources ready {run.sourcesReady.toLocaleString("en")} ms
            </Text>
          </g>
        );
      })}

      <line x1={LEFT} x2={RIGHT} y1={AXIS} y2={AXIS} stroke="var(--border)" strokeWidth={1.5} />
      {[0, 500, 1000, 1500, 2000, 2500, 3000, 3500].map((ms) => (
        <g key={ms}>
          <line x1={x(ms)} x2={x(ms)} y1={AXIS} y2={AXIS + 4} stroke="var(--muted-foreground)" />
          <Text x={x(ms)} y={AXIS + 18} anchor="middle" size={11} muted>
            {ms === 0 ? "0" : `${ms / 1000} s`}
          </Text>
        </g>
      ))}
    </Svg>
  );
}
