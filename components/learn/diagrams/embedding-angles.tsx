import { Arrow, ink, Svg, Text } from "./kit";

// A 2D sketch, so the angles are chosen to be readable, not measured.
const O = [250, 262] as const;
const LEN = 180;

const at = (deg: number, r: number) =>
  [O[0] + r * Math.cos((deg * Math.PI) / 180), O[1] - r * Math.sin((deg * Math.PI) / 180)] as const;

function arc(from: number, to: number, r: number) {
  const [x1, y1] = at(from, r);
  const [x2, y2] = at(to, r);
  return `M ${x1} ${y1} A ${r} ${r} 0 0 0 ${x2} ${y2}`;
}

const sky = 32;
const rayleigh = 46;
const postgres = 118;

/** Embeddings: similar meanings point in similar directions. */
export function EmbeddingAnglesDiagram() {
  const skyEnd = at(sky, LEN);
  const rayEnd = at(rayleigh, LEN);
  const pgEnd = at(postgres, LEN);
  return (
    <Svg height={290}>
      {/* Two of the 768 axes. */}
      <line
        x1={O[0] - 200}
        x2={O[0] + 300}
        y1={O[1]}
        y2={O[1]}
        stroke="var(--border)"
        strokeWidth={1.5}
      />
      <line x1={O[0]} x2={O[0]} y1={O[1] + 10} y2={30} stroke="var(--border)" strokeWidth={1.5} />
      <Text x={O[0] + 300} y={O[1] + 18} anchor="end" size={11} muted>
        2 of the 768 dimensions
      </Text>

      <path d={arc(sky, rayleigh, 120)} fill="none" stroke={ink(3)} strokeWidth={2.5} />
      <path
        d={arc(rayleigh, postgres, 64)}
        fill="none"
        stroke={ink(8)}
        strokeWidth={2.5}
        strokeDasharray="4 3"
      />

      <Arrow points={[O, skyEnd]} tone={2} />
      <Arrow points={[O, rayEnd]} tone={3} />
      <Arrow points={[O, pgEnd]} tone={8} />

      <Text x={skyEnd[0] + 8} y={skyEnd[1] + 10} tone={2} weight={600}>
        &quot;Why is the sky blue?&quot;
      </Text>
      <Text x={rayEnd[0] + 8} y={rayEnd[1] - 2} tone={3} weight={600}>
        &quot;Rayleigh scattering makes it blue.&quot;
      </Text>
      <Text x={pgEnd[0] - 8} y={pgEnd[1] - 8} anchor="middle" tone={8} weight={600}>
        &quot;Postgres supports JSONB columns.&quot;
      </Text>

      <Text x={470} y={190} size={12} tone={3}>
        small angle: similar meaning, close
      </Text>
      <Text x={470} y={206} size={12} muted>
        cosine near the top of the range
      </Text>
      <Text x={20} y={210} size={12} tone={8}>
        wide angle: unrelated, far
      </Text>
      <Text x={20} y={226} size={12} muted>
        cosine lower
      </Text>
    </Svg>
  );
}
