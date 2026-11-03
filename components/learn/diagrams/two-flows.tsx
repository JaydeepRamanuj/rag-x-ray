import { Arrow, Box, columns, Svg, Text } from "./kit";

const BW = 88;
const col = columns(7, BW);
const mid = (i: number) => col(i) + BW / 2;

const ingest = [
  { title: "Upload", sub: ".pdf .md .txt" },
  { title: "Chunk", sub: "~400 tokens" },
  { title: "Embed", sub: "768 numbers" },
];

const ask = [
  { title: "Question" },
  { title: "Embed", sub: "same model" },
  { title: "Search", sub: "nearest" },
  { title: "Top 5", sub: "chunks" },
  { title: "Prompt", sub: "rules + sources" },
  { title: "Model", sub: "Gemini" },
  { title: "Answer", sub: "cites [1] [2]" },
];

const ROW1 = 30;
const STORE = 130;
const ROW2 = 228;
const H = 56;

/** Start here: ingestion once per document, and the question flow, meeting at the vector store. */
export function TwoFlowsDiagram() {
  return (
    <Svg height={292}>
      <Text x={0} y={18} weight={600} tone={1}>
        Once per document
      </Text>
      {ingest.map((b, i) => (
        <Box key={i} x={col(i)} y={ROW1} w={BW} h={H} tone={1} {...b} />
      ))}
      {ingest.slice(1).map((_, i) => (
        <Arrow
          key={i}
          points={[
            [col(i) + BW, ROW1 + H / 2],
            [col(i + 1) - 2, ROW1 + H / 2],
          ]}
          tone={1}
        />
      ))}

      <Box
        x={mid(2) - 72}
        y={STORE}
        w={144}
        h={50}
        tone={7}
        title="Vector store"
        sub="Neon + pgvector"
      />
      <Arrow
        points={[
          [mid(2), ROW1 + H],
          [mid(2), STORE - 2],
        ]}
        tone={1}
      />
      <Arrow
        points={[
          [mid(2), ROW2 - 2],
          [mid(2), STORE + 52],
        ]}
        tone={2}
        both
      />
      <Text x={mid(2) + 92} y={STORE + 22} muted size={12}>
        The two flows meet here: chunks go in once,
      </Text>
      <Text x={mid(2) + 92} y={STORE + 38} muted size={12}>
        and every question searches them.
      </Text>

      <Text x={0} y={ROW2 - 12} weight={600} tone={2}>
        Every question
      </Text>
      {ask.map((b, i) => (
        <Box key={i} x={col(i)} y={ROW2} w={BW} h={H} tone={i === ask.length - 1 ? 3 : 2} {...b} />
      ))}
      {ask.slice(1).map((_, i) => (
        <Arrow
          key={i}
          points={[
            [col(i) + BW, ROW2 + H / 2],
            [col(i + 1) - 2, ROW2 + H / 2],
          ]}
          tone={2}
        />
      ))}
    </Svg>
  );
}
