import { ink, Svg, Text, wash, type Tone } from "./kit";

// Gemini's own counts for "Are we using drizzle?" (Lesson 9's table).
const SOURCES = 2150;
const parts: { label: string; tokens: number; tone: Tone }[] = [
  { label: "system", tokens: 75, tone: 7 },
  { label: "history ×2", tokens: 19, tone: "neutral" },
  { label: "framing", tokens: 7, tone: "neutral" },
  // Drawn as five equal parts; the table gives only their total.
  ...[1, 2, 3, 4, 5].map((n) => ({ label: `[${n}]`, tokens: SOURCES / 5, tone: 1 as Tone })),
  { label: "question", tokens: 12, tone: 2 },
];
const TOTAL = parts.reduce((s, p) => s + p.tokens, 0);

const LEFT = 150;
const RIGHT = 700;
const BAR_Y = 96;
const BAR_H = 36;
const scale = (RIGHT - LEFT) / TOTAL;

// Each part starts where the tokens before it end.
const spans = parts.map((p, i) => ({
  ...p,
  x: LEFT + parts.slice(0, i).reduce((s, q) => s + q.tokens, 0) * scale,
  w: p.tokens * scale,
}));
const small = spans.slice(0, 3);
const question = spans[spans.length - 1];

/** Prompt construction: where the input tokens of one real prompt went. */
export function PromptBudgetDiagram() {
  return (
    <Svg height={186}>
      {small.map((s, i) => (
        <g key={s.label}>
          <Text x={LEFT - 12} y={30 + i * 20} anchor="end" size={12}>
            {`${s.label} ${s.tokens}`}
          </Text>
          <polyline
            points={`${LEFT - 8},${26 + i * 20} ${s.x + s.w / 2},${26 + i * 20} ${s.x + s.w / 2},${BAR_Y - 2}`}
            fill="none"
            stroke="var(--muted-foreground)"
          />
        </g>
      ))}
      <Text x={RIGHT} y={30} anchor="end" size={12}>
        {`question ${question.tokens}`}
      </Text>
      <polyline
        points={`${RIGHT - 4},36 ${question.x + question.w / 2},${BAR_Y - 2}`}
        fill="none"
        stroke="var(--muted-foreground)"
      />

      {spans.map((s, i) => (
        <g key={i}>
          <rect
            x={s.x}
            y={BAR_Y}
            width={s.w}
            height={BAR_H}
            fill={wash(s.tone, 35)}
            stroke={ink(s.tone)}
            strokeWidth={0.75}
          />
          {s.tone === 1 && (
            <Text x={s.x + s.w / 2} y={BAR_Y + BAR_H / 2 + 4} anchor="middle" size={12}>
              {s.label}
            </Text>
          )}
        </g>
      ))}

      <path
        d={`M ${spans[3].x} ${BAR_Y + BAR_H + 6} v 6 H ${question.x} v -6`}
        fill="none"
        stroke={ink(1)}
      />
      <Text
        x={(spans[3].x + question.x) / 2}
        y={BAR_Y + BAR_H + 30}
        anchor="middle"
        size={12}
        tone={1}
        weight={600}
      >
        {`sources ×5: ${SOURCES.toLocaleString("en")} tokens, 95% of the prompt`}
      </Text>
      <Text x={0} y={BAR_Y + 22} weight={600}>
        Input tokens
      </Text>
      <Text x={0} y={BAR_Y + 38} size={11.5} muted>
        2,260 billed
      </Text>
    </Svg>
  );
}
