import { ink, Svg, Text, wash } from "./kit";

// Lesson 10's example: the rank of the first hit for four questions (0 = miss).
const firstHit = [1, 2, 0, 4];
const K = 5;

const LEFT = 100;
const CELL = 44;
const TOP = 34;
const ROW = 38;
const HIT_X = LEFT + K * CELL + 40;
const RR_X = HIT_X + 170;

const hits = firstHit.filter((r) => r > 0).length;
const reciprocal = firstHit.map((r) => (r > 0 ? 1 / r : 0));
const mrr = reciprocal.reduce((s, v) => s + v, 0) / firstHit.length;
const fmt = (v: number) => (v === 0 ? "0" : Number(v.toFixed(2)).toString());

/** Evaluating RAG: hit rate@5 and MRR from where each question's first hit landed. */
export function HitRankDiagram() {
  const bottom = TOP + firstHit.length * ROW;
  return (
    <Svg height={bottom + 42}>
      <Text x={LEFT + (K * CELL) / 2} y={14} anchor="middle" size={11.5} muted>
        retrieved, by rank
      </Text>
      {Array.from({ length: K }, (_, i) => (
        <Text
          key={i}
          x={LEFT + i * CELL + CELL / 2}
          y={TOP - 4}
          anchor="middle"
          size={12}
          weight={600}
        >
          {i + 1}
        </Text>
      ))}
      <Text x={HIT_X} y={TOP - 4} anchor="middle" size={12} weight={600}>
        hit in top 5?
      </Text>
      <Text x={RR_X} y={TOP - 4} anchor="middle" size={12} weight={600}>
        1 / rank
      </Text>

      {firstHit.map((rank, q) => {
        const y = TOP + q * ROW;
        return (
          <g key={q}>
            <Text x={0} y={y + 23}>
              {`question ${q + 1}`}
            </Text>
            {Array.from({ length: K }, (_, i) => {
              const hit = i + 1 === rank;
              return (
                <rect
                  key={i}
                  x={LEFT + i * CELL + 4}
                  y={y + 4}
                  width={CELL - 8}
                  height={ROW - 8}
                  rx={5}
                  fill={hit ? wash(3, 55) : wash("neutral", 8)}
                  stroke={hit ? ink(3) : "var(--border)"}
                />
              );
            })}
            <Text x={HIT_X} y={y + 23} anchor="middle" tone={rank ? 3 : 8} weight={600}>
              {rank ? "yes" : "miss"}
            </Text>
            <Text x={RR_X} y={y + 23} anchor="middle" mono>
              {rank ? `1/${rank} = ${fmt(reciprocal[q])}` : "0"}
            </Text>
          </g>
        );
      })}

      <line x1={0} x2={720} y1={bottom + 8} y2={bottom + 8} stroke="var(--border)" />
      <Text x={HIT_X} y={bottom + 30} anchor="middle" weight={600}>
        {`hit rate@5 = ${hits}/${firstHit.length} = ${fmt(hits / firstHit.length)}`}
      </Text>
      <Text x={RR_X} y={bottom + 30} anchor="middle" weight={600}>
        {`MRR = average = ${fmt(mrr)}`}
      </Text>
    </Svg>
  );
}
