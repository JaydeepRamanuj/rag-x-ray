import Link from "next/link";

import { Term } from "@/components/term";

import type { Guide } from "./types";

const EXAMPLE_RUN = "/runs/0f59bf82-0072-4b8a-82e3-446c8f1d02aa/prompt";

export const promptInspectorGuide: Guide = {
  match: (p) => /^\/runs\/[^/]+\/prompt$/.test(p),
  title: "Prompt inspector",
  summary: (
    <p>
      The exact text the model received for one answer, split into its parts: the rules, earlier
      conversation, each source, and your question, with how many <Term id="token">tokens</Term>{" "}
      each part used. You can change the rules or remove sources and ask again, to see how the
      answer changes.
    </p>
  ),
  why: (
    <>
      <p>
        You type one short question, but the model receives something about a hundred times longer.
        Everything the model knows about your documents is in that <Term id="prompt" />, so when an
        answer is wrong, this is where to look first: was the right source in it at all?
      </p>
      <p>
        <strong>Without it</strong> the prompt is invisible, and you&apos;d blame the model for
        problems that were really in what it was given. You&apos;d also not see that the sources are
        where almost all the cost goes.
      </p>
    </>
  ),
  inputs: [
    {
      name: "Count with … tokenizer",
      what: "Asks the provider to count each part with the model's own tokenizer, instead of the quick local estimate.",
    },
    {
      name: "Keep switch on each source",
      what: "Turn a source off to leave it out of the next re-run. The counter shows how many tokens that saves.",
    },
    {
      name: "System prompt box",
      what: (
        <>
          The rules the model follows (<Term id="system-prompt" />
          ). Edit them, for example delete &quot;Never invent a source&quot;, and re-run. Reset puts
          them back.
        </>
      ),
    },
    {
      name: "Model to re-run on",
      what: "Send the same prompt to a different model, to compare models on identical input.",
    },
    {
      name: "Re-run",
      what: "Sends the edited prompt without searching again, so the only thing that changes is what you changed. It's saved as a new run.",
    },
  ],
  steps: [
    {
      do: (
        <>
          Ask something in Chat and press <strong>Inspect</strong> under the answer (or open{" "}
          <Link href={EXAMPLE_RUN}>this example run</Link>).
        </>
      ),
      see: "The question and its numbers at the top, then a coloured bar under Token budget.",
    },
    {
      do: "Read the Token budget table.",
      see: "In the example: system prompt 69 tokens (4%), framing 6, sources 1,696 (95%), question 18. The sources are nearly the whole prompt; your question is 1%.",
    },
    {
      do: "Compare Sum of parts with Billed by the provider.",
      see: "1,791 estimated against 1,910 billed. The gap is the provider's own counting plus the hidden role markers it wraps around each message.",
    },
    {
      do: "Scroll to Messages as sent and open a source.",
      see: "The chunk exactly as the model saw it, with its [number] and file name. This is where to check that the answer's source really says what the answer claims.",
    },
    {
      do: "Switch off the source the answer cited, then press Re-run.",
      see: "The original and the re-run side by side. Without its source, the model should say the sources don't cover it, or answer from a weaker one. Input tokens drop by that source's size.",
    },
  ],
  reading: [
    {
      name: "The top line",
      what: (
        <>
          Model, status, how the sources were found (&quot;RAG, top 5&quot;), where the run came
          from (chat, inspector, debugger, sdk), <Term id="ttft" />, total time and{" "}
          <Term id="cost-if-paid" />.
        </>
      ),
    },
    {
      name: "Token budget bar",
      what: "One coloured block per part, sized by its tokens. The striped end is the difference between the estimate and what the provider billed.",
    },
    {
      name: "Framing",
      what: 'The small fixed text around the sources, like "Sources:" and "Question:".',
    },
    {
      name: "History",
      what: "Earlier turns of the conversation, sent again each time so follow-ups make sense. Long chats make every new question cost more.",
    },
    {
      name: "input → $, output → $",
      what: (
        <>
          The cost split. <Term id="input-output-tokens">Output tokens</Term> cost more each, but in
          RAG input usually dominates because the sources are long.
        </>
      ),
    },
    {
      name: "Original vs re-run",
      what: "Both answers with their tokens, timings and cost, and the change in input tokens and cost from your edit.",
    },
  ],
  pros: [
    "Shows what the model was actually told, so you can tell a retrieval problem from a model problem.",
    "Re-runs change one thing at a time on an identical prompt: a fair experiment.",
    "Makes cost concrete: you see which part of the prompt you're paying for.",
  ],
  cons: [
    "Local token counts are estimates (an OpenAI tokenizer); the provider's own count differs by a few percent.",
    "Re-runs don't search again, so they can't test a different retrieval setting. Use the arena or chat for that.",
    "Each re-run is a real request and uses free-tier quota.",
  ],
  surprises: [
    '"This run\'s chunks are no longer in the database": the document was re-uploaded or deleted, or the run came from a debugger replay. The sources are read back from the saved prompt text instead.',
    "Billed tokens are always more than the sum of parts. Every message gets hidden role markers.",
    "The re-run's answer differs even with nothing changed. The model's word choice has some randomness.",
  ],
  lessons: ["prompt-construction", "tokens"],
  next: {
    href: "/runs/0f59bf82-0072-4b8a-82e3-446c8f1d02aa/stream",
    label: "Streaming debugger: how the answer arrives",
  },
};
