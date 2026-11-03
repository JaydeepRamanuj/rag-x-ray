import { chatModels, limits } from "@/lib/config";

import { Arrow, Box, columns, Svg } from "./kit";

const BW = 96;
const col = columns(6, BW);
const mid = (i: number) => col(i) + BW / 2;
const steps = ["Question", "Embed", "Retrieve", "Prompt", "LLM", "Answer"];
const ROW = 8;
const H = 40;
const CALL = 110;
const price = chatModels.geminiFlashLite.price;

/** Caching and cost: the three levers, and where each one acts. */
export function CostLeversDiagram() {
  return (
    <Svg height={212}>
      {steps.map((s, i) => (
        <Box
          key={s}
          x={col(i)}
          y={ROW}
          w={BW}
          h={H}
          title={s}
          tone={i === 1 || i === 4 ? 1 : "neutral"}
        />
      ))}
      {steps.slice(1).map((_, i) => (
        <Arrow
          key={i}
          points={[
            [col(i) + BW, ROW + H / 2],
            [col(i + 1) - 2, ROW + H / 2],
          ]}
        />
      ))}

      <Arrow
        points={[
          [mid(1), ROW + H],
          [110, CALL - 2],
        ]}
        tone={3}
        dashed
      />
      <Arrow
        points={[
          [mid(4), ROW + H],
          [362, CALL - 2],
        ]}
        tone={4}
        dashed
      />
      <Arrow
        points={[
          [mid(4), ROW + H],
          [608, CALL - 2],
        ]}
        tone={8}
        dashed
      />

      <Box
        x={0}
        y={CALL}
        w={225}
        h={96}
        tone={3}
        title="1. Skip the call"
        sub={[
          "Upstash keeps each vector, keyed by",
          "text + model + task type.",
          "Repeat question: ~1.1 s → 0.16 s",
        ]}
      />
      <Box
        x={248}
        y={CALL}
        w={228}
        h={96}
        tone={4}
        title="2. Pay less"
        sub={[
          "Gemini caches a repeated prefix:",
          `$${price.cachedInput.toFixed(2)} instead of $${price.input.toFixed(2)} per million.`,
          "RAG prompts barely repeat.",
        ]}
      />
      <Box
        x={496}
        y={CALL}
        w={224}
        h={96}
        tone={8}
        title="3. Pace it"
        sub={[
          "429: wait the retry-after, else",
          "back off with jitter,",
          `up to ${limits.retry.maxAttempts} attempts`,
        ]}
      />
    </Svg>
  );
}
