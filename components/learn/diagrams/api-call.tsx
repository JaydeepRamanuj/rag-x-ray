import { defaults } from "@/lib/config";

import { Arrow, Box, ink, Svg, Text, wash, type Tone } from "./kit";

const request: { role: string; text: string; tone: Tone }[] = [
  { role: "system", text: "Be concise.", tone: 7 },
  { role: "user", text: "Hi", tone: 2 },
  { role: "assistant", text: "Hello!", tone: 3 },
  { role: "user", text: "Why is the sky blue?", tone: 2 },
];

function Message({
  x,
  y,
  w,
  role,
  text,
  tone,
}: {
  x: number;
  y: number;
  w: number;
  role: string;
  text: string;
  tone: Tone;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={28} rx={6} fill={wash(tone)} stroke={ink(tone)} />
      <Text x={x + 10} y={y + 18} size={11.5} tone={tone} weight={600}>
        {role}
      </Text>
      <Text x={x + 84} y={y + 18} size={12.5}>
        {text}
      </Text>
    </g>
  );
}

/** LLM API call: a stateless function from a message list to one more message. */
export function ApiCallDiagram() {
  return (
    <Svg height={262}>
      <Text x={0} y={16} weight={600}>
        Request
      </Text>
      <rect x={0} y={26} width={300} height={190} rx={8} fill="none" stroke="var(--border)" />
      {request.map((m, i) => (
        <Message key={i} x={12} y={38 + i * 36} w={276} {...m} />
      ))}
      <Text x={12} y={200} size={11.5} muted>
        {`temperature ${defaults.temperature} · max output ${defaults.maxOutputTokens.toLocaleString("en")}`}
      </Text>

      <Arrow
        points={[
          [300, 121],
          [352, 121],
        ]}
      />
      <Box x={358} y={92} w={110} h={58} title="model" sub="no memory" />
      <Arrow
        points={[
          [468, 121],
          [520, 121],
        ]}
      />

      <Text x={526} y={16} weight={600}>
        Response
      </Text>
      <rect x={526} y={26} width={194} height={118} rx={8} fill="none" stroke="var(--border)" />
      <rect x={538} y={38} width={170} height={46} rx={6} fill={wash(3)} stroke={ink(3)} />
      <Text x={548} y={56} size={11.5} tone={3} weight={600}>
        assistant
      </Text>
      <Text x={548} y={74} size={12.5}>
        Rayleigh scattering…
      </Text>
      <Text x={538} y={108} size={12} mono>
        usage: in 31, out 12
      </Text>
      <Text x={538} y={130} size={11.5} muted>
        tokens read and written
      </Text>

      {/* The next turn re-sends everything, plus this answer. */}
      <Arrow
        points={[
          [623, 144],
          [623, 240],
          [150, 240],
          [150, 220],
        ]}
        tone={3}
        dashed
      />
      <Text x={386} y={256} anchor="middle" size={11.5} muted>
        next turn: the whole list is sent again, with this answer added
      </Text>
    </Svg>
  );
}
