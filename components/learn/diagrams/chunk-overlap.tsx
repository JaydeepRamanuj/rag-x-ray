import { defaults } from "@/lib/config";

import { ink, Svg, Text, wash } from "./kit";

const SIZE = defaults.chunkSize;
const OVERLAP = defaults.chunkOverlap;
const DOC = 1150;

// Fixed-size chunking: each chunk starts OVERLAP tokens before the last ended.
const chunks = [0, 1, 2].map((i) => {
  const start = i * (SIZE - OVERLAP);
  return { start, end: Math.min(start + SIZE, DOC) };
});

const LEFT = 80;
const RIGHT = 700;
const MAX = 1200;
const x = (t: number) => LEFT + (t / MAX) * (RIGHT - LEFT);
const H = 28;
const DOC_Y = 34;
const ROW = (i: number) => 84 + i * 40;
const AXIS = 214;

/** Chunking: 400-token chunks, each repeating the previous chunk's last 40 tokens. */
export function ChunkOverlapDiagram() {
  return (
    <Svg height={240}>
      <rect x={x(680)} y={4} width={12} height={12} rx={2} fill={wash(4, 55)} stroke={ink(4)} />
      <Text x={x(680) + 18} y={14} size={12}>
        overlap: {OVERLAP} tokens appear in both chunks
      </Text>

      <Text x={0} y={DOC_Y + 18} weight={600}>
        Document
      </Text>
      <rect
        x={x(0)}
        y={DOC_Y}
        width={x(DOC) - x(0)}
        height={H}
        rx={4}
        fill={wash("neutral", 10)}
        stroke={ink("neutral")}
      />
      {/* Faint "lines of text" so the bar reads as a document. */}
      {[0, 1, 2].map((l) => (
        <line
          key={l}
          x1={x(10)}
          x2={x(DOC - 10 - l * 140)}
          y1={DOC_Y + 8 + l * 6}
          y2={DOC_Y + 8 + l * 6}
          stroke="var(--border)"
          strokeWidth={2}
        />
      ))}

      {chunks.map((c, i) => {
        const y = ROW(i);
        const next = chunks[i + 1];
        return (
          <g key={i}>
            <Text x={0} y={y + 18} weight={600} tone={1}>
              Chunk {i + 1}
            </Text>
            <rect
              x={x(c.start)}
              y={y}
              width={x(c.end) - x(c.start)}
              height={H}
              rx={4}
              fill={wash(1)}
              stroke={ink(1)}
            />
            {/* The tokens this chunk shares with its neighbours. */}
            {i > 0 && (
              <rect
                x={x(c.start)}
                y={y}
                width={x(c.start + OVERLAP) - x(c.start)}
                height={H}
                fill={wash(4, 55)}
                stroke={ink(4)}
              />
            )}
            {next && (
              <rect
                x={x(next.start)}
                y={y}
                width={x(c.end) - x(next.start)}
                height={H}
                fill={wash(4, 55)}
                stroke={ink(4)}
              />
            )}
            <Text x={(x(c.start) + x(c.end)) / 2} y={y + 18} anchor="middle" size={12}>
              {`tokens ${c.start}–${c.end}`}
            </Text>
            {/* Guides down from the document to where this chunk sits in it. */}
            <line
              x1={x(c.start)}
              x2={x(c.start)}
              y1={DOC_Y + H}
              y2={y}
              stroke={ink(1)}
              strokeDasharray="2 3"
            />
            <line
              x1={x(c.end)}
              x2={x(c.end)}
              y1={DOC_Y + H}
              y2={y}
              stroke={ink(1)}
              strokeDasharray="2 3"
            />
          </g>
        );
      })}

      <line x1={x(0)} x2={x(MAX)} y1={AXIS} y2={AXIS} stroke="var(--border)" strokeWidth={1.5} />
      {[0, 200, 400, 600, 800, 1000, 1200].map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={AXIS} y2={AXIS + 4} stroke="var(--muted-foreground)" />
          <Text x={x(t)} y={AXIS + 18} anchor="middle" size={11} muted>
            {t}
          </Text>
        </g>
      ))}
      <Text x={0} y={AXIS + 18} size={11} muted>
        tokens
      </Text>
    </Svg>
  );
}
