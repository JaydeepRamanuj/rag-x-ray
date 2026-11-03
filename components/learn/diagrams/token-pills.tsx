import { chatModels } from "@/lib/config";

import { Arrow, ink, Svg, Text, wash, type Tone } from "./kit";

// The lesson's example split. A leading space belongs to the token after it.
const tokens = ["Why", " is", " the", " sky", " blue", "?"];
const price = chatModels.geminiFlashLite.price;

const CHAR = 8.4; // monospace advance at 14px
const PAD = 10;

// Pills laid out left to right, 6 apart; `end` is where the last one stops.
const pills: { t: string; x: number; w: number; tone: Tone }[] = [];
for (const [i, t] of tokens.entries()) {
  const prev = pills[i - 1];
  const x = prev ? prev.x + prev.w + 6 : 0;
  pills.push({ t, x, w: t.length * CHAR + PAD * 2, tone: ([1, 2, 3, 4, 7, 5] as const)[i] });
}
const end = pills[pills.length - 1].x + pills[pills.length - 1].w + 6;

const BAR_MAX = 440;
const bar = (usd: number) => (usd / price.output) * BAR_MAX;

/** Tokens: text is read in pieces, and output pieces cost more than input ones. */
export function TokenPillsDiagram() {
  return (
    <Svg height={206}>
      <Text x={0} y={20} size={14} mono>
        &quot;Why is the sky blue?&quot;
      </Text>
      <Arrow
        points={[
          [90, 30],
          [90, 52],
        ]}
      />
      {pills.map((p) => (
        <g key={p.x}>
          <rect
            x={p.x}
            y={58}
            width={p.w}
            height={30}
            rx={6}
            fill={wash(p.tone, 30)}
            stroke={ink(p.tone)}
          />
          <Text x={p.x + PAD} y={78} size={14} mono>
            {p.t.replace(" ", "␣")}
          </Text>
        </g>
      ))}
      <Text x={end + 2} y={78}>
        ≈ 6 tokens
      </Text>
      <Text x={0} y={108} size={11.5} muted>
        ␣ marks the space each token carries in front of it
      </Text>

      <Text x={0} y={146} size={12} weight={600}>
        Gemini 3.5 Flash-Lite, per million tokens
      </Text>
      <rect
        x={70}
        y={156}
        width={bar(price.input)}
        height={16}
        rx={3}
        fill={wash(1, 40)}
        stroke={ink(1)}
      />
      <Text x={0} y={168} size={12}>
        input
      </Text>
      <Text x={70 + bar(price.input) + 8} y={168} size={12}>
        {`$${price.input.toFixed(2)}`}
      </Text>
      <rect
        x={70}
        y={180}
        width={bar(price.output)}
        height={16}
        rx={3}
        fill={wash(2, 40)}
        stroke={ink(2)}
      />
      <Text x={0} y={192} size={12}>
        output
      </Text>
      <Text x={70 + bar(price.output) + 8} y={192} size={12}>
        {`$${price.output.toFixed(2)}, about ${Math.round(price.output / price.input)}× input`}
      </Text>
    </Svg>
  );
}
