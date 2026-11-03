import { defaults } from "@/lib/config";

import { Arrow, Box, ink, Svg, Text, wash, type Tone } from "./kit";

// Lesson 13's corpus had 64 chunks; retrieval keeps 20, the reranker 5.
const ALL = 64;
const CANDIDATES = defaults.candidates;
const TOP = defaults.topK;

function Grid({
  x,
  y,
  n,
  cols,
  tone,
}: {
  x: number;
  y: number;
  n: number;
  cols: number;
  tone: Tone;
}) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <rect
          key={i}
          x={x + (i % cols) * 15}
          y={y + Math.floor(i / cols) * 15}
          width={11}
          height={11}
          rx={2}
          fill={wash(tone, 35)}
          stroke={ink(tone)}
          strokeWidth={0.75}
        />
      ))}
    </g>
  );
}

/** Reranking: cheap retrieval narrows, the cross-encoder orders; and how the two score. */
export function RerankFunnelDiagram() {
  return (
    <Svg height={330}>
      <Grid x={0} y={20} n={ALL} cols={8} tone="neutral" />
      <Text x={58} y={152} anchor="middle" size={12} weight={600}>
        {`all ${ALL} chunks`}
      </Text>

      <Arrow
        points={[
          [135, 78],
          [262, 78],
        ]}
      />
      <Text x={198} y={66} anchor="middle" size={11.5}>
        vector + keyword
      </Text>
      <Text x={198} y={96} anchor="middle" size={11.5} muted>
        milliseconds
      </Text>

      <Grid x={278} y={42} n={CANDIDATES} cols={5} tone={4} />
      <Text x={313} y={152} anchor="middle" size={12} weight={600}>
        {`${CANDIDATES} candidates`}
      </Text>

      <Arrow
        points={[
          [362, 78],
          [500, 78],
        ]}
      />
      <Text x={431} y={66} anchor="middle" size={11.5}>
        Cohere cross-encoder
      </Text>
      <Text x={431} y={96} anchor="middle" size={11.5} muted>
        about 1 s
      </Text>

      <Grid x={516} y={72} n={TOP} cols={5} tone={3} />
      <Text x={553} y={152} anchor="middle" size={12} weight={600}>
        {`best ${TOP}`}
      </Text>
      <Arrow
        points={[
          [600, 78],
          [650, 78],
        ]}
      />
      <Text x={660} y={82} size={12}>
        prompt
      </Text>

      <line x1={0} x2={720} y1={176} y2={176} stroke="var(--border)" />

      <Text x={0} y={204} weight={600}>
        Bi-encoder
      </Text>
      <Text x={0} y={220} size={11.5} muted>
        retrieval: find candidates
      </Text>
      <Box x={170} y={190} w={150} h={30} tone={2} title="question" />
      <Box x={170} y={228} w={150} h={30} tone={1} title="chunk" />
      <Arrow
        points={[
          [320, 205],
          [360, 205],
        ]}
      />
      <Arrow
        points={[
          [320, 243],
          [360, 243],
        ]}
      />
      <Text x={366} y={209} size={12} mono>
        [0.01, …]
      </Text>
      <Text x={366} y={247} size={12} mono>
        [0.02, …]
      </Text>
      <Text x={366} y={262} size={11} muted>
        computed once, at upload
      </Text>
      <Arrow
        points={[
          [446, 205],
          [496, 222],
        ]}
      />
      <Arrow
        points={[
          [446, 243],
          [496, 228],
        ]}
      />
      <Text x={506} y={230} size={12}>
        dot product = score
      </Text>

      <Text x={0} y={290} weight={600}>
        Cross-encoder
      </Text>
      <Text x={0} y={306} size={11.5} muted>
        rerank: order them
      </Text>
      <Box x={170} y={280} w={190} h={34} tone={4} title="question + chunk" sub="read together" />
      <Arrow
        points={[
          [360, 297],
          [400, 297],
        ]}
      />
      <Box x={406} y={280} w={66} h={34} title="model" />
      <Arrow
        points={[
          [472, 297],
          [512, 297],
        ]}
      />
      <Text x={520} y={301} size={12}>
        score 0–1, one pass per candidate
      </Text>
    </Svg>
  );
}
