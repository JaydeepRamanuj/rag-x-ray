import { describe, expect, it } from "vitest";

import { buildJudgeMessages, parseJudgeReply } from "./judge";

describe("buildJudgeMessages", () => {
  it("puts the rubric in the system message and every case in the user message", () => {
    const messages = buildJudgeMessages([
      {
        id: "q1",
        question: "What is RRF?",
        sources: "[1] a\nRRF fuses ranks.",
        answer: "It fuses ranks [1].",
      },
      {
        id: "q2",
        question: "What is HNSW?",
        sources: "[1] b\nA graph index.",
        answer: "A graph [1].",
      },
    ]);
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("Faithfulness (1-5)");
    expect(messages[1].content).toContain("=== Case q1 ===");
    expect(messages[1].content).toContain("=== Case q2 ===");
    expect(messages[1].content).toContain("RRF fuses ranks.");
  });
});

describe("parseJudgeReply", () => {
  const ids = ["q1", "q2"];

  it("reads the documented shape", () => {
    const reply = JSON.stringify({
      results: [
        { id: "q1", reasoning: "Supported.", faithfulness: 5, relevance: 4 },
        { id: "q2", reasoning: "Partly.", faithfulness: 3, relevance: 3 },
      ],
    });
    const verdicts = parseJudgeReply(reply, ids);
    expect(verdicts.get("q1")).toEqual({ reasoning: "Supported.", faithfulness: 5, relevance: 4 });
    expect(verdicts.get("q2")?.faithfulness).toBe(3);
  });

  it("tolerates a code fence, a bare array and string scores", () => {
    const reply = '```json\n[{"id":"q1","reasoning":"ok","faithfulness":"4","relevance":5}]\n```';
    expect(parseJudgeReply(reply, ids).get("q1")).toEqual({
      reasoning: "ok",
      faithfulness: 4,
      relevance: 5,
    });
  });

  it("drops unknown ids, duplicates and out-of-range scores", () => {
    const reply = JSON.stringify({
      results: [
        { id: "q9", faithfulness: 5, relevance: 5 },
        { id: "q1", reasoning: "first", faithfulness: 7, relevance: 0 },
        { id: "q1", reasoning: "second", faithfulness: 2, relevance: 2 },
      ],
    });
    const verdicts = parseJudgeReply(reply, ids);
    expect(verdicts.size).toBe(1);
    expect(verdicts.get("q1")).toEqual({ reasoning: "first", faithfulness: null, relevance: null });
  });

  it("returns nothing for text that isn't JSON", () => {
    expect(parseJudgeReply("I think both answers are good.", ids).size).toBe(0);
  });
});
