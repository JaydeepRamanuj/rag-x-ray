import { Arrow, Box, ink, Svg, Text, type Tone } from "./kit";

const B = 110;
const R = 380;
const P = 640;

type Msg = { from: number; to: number; y: number; label: string; tone?: Tone; mono?: boolean };

// The order /api/chat sends events in (lib/chat/events.ts), trimmed to the main ones.
const messages: Msg[] = [
  { from: B, to: R, y: 78, label: "POST /api/chat" },
  { from: R, to: B, y: 102, label: "event: start", mono: true, tone: 2 },
  { from: R, to: B, y: 126, label: "event: retrieval (RAG mode)", mono: true, tone: 2 },
  { from: R, to: P, y: 150, label: "POST, streaming on" },
  ...[0, 1, 2].flatMap((i): Msg[] => [
    { from: P, to: R, y: 182 + i * 34, label: "data: {…}", mono: true, tone: 1 },
    { from: R, to: B, y: 192 + i * 34, label: "event: token", mono: true, tone: 2 },
  ]),
  { from: R, to: B, y: 300, label: "event: usage, then done", mono: true, tone: 2 },
];

/** Streaming: two SSE hops, provider to our route and our route to the browser. */
export function StreamHopsDiagram() {
  return (
    <Svg height={322}>
      {[
        { x: B, title: "Browser" },
        { x: R, title: "Next.js route" },
        { x: P, title: "Gemini / Groq" },
      ].map((l) => (
        <g key={l.x}>
          <Box x={l.x - 70} y={8} w={140} h={34} title={l.title} />
          <line x1={l.x} x2={l.x} y1={42} y2={316} stroke="var(--border)" strokeWidth={1.5} />
        </g>
      ))}

      {messages.map((m, i) => {
        const dir = Math.sign(m.to - m.from);
        return (
          <g key={i}>
            <Arrow
              points={[
                [m.from + dir * 3, m.y],
                [m.to - dir * 3, m.y],
              ]}
              tone={m.tone}
            />
            <Text x={(m.from + m.to) / 2} y={m.y - 5} anchor="middle" size={11.5} mono={m.mono}>
              {m.label}
            </Text>
          </g>
        );
      })}
      <Text x={(R + P) / 2} y={286} anchor="middle" size={11.5} muted>
        … one frame per few tokens
      </Text>

      {/* Time to first token, as the browser sees it. */}
      <path d={`M 62 78 h -6 V 192 h 6`} fill="none" stroke={ink(3)} strokeWidth={1.5} />
      <Text x={50} y={139} anchor="end" size={11.5} tone={3} weight={600}>
        TTFT
      </Text>
    </Svg>
  );
}
