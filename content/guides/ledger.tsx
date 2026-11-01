import { Term } from "@/components/term";

import type { Guide } from "./types";

export const ledgerGuide: Guide = {
  match: (p) => p === "/ledger",
  title: "Token ledger",
  summary: (
    <p>
      The bill. Every <Term id="run" /> is listed with its <Term id="token">tokens</Term>, timings
      and what it would cost on a paid plan. Charts show daily use against the{" "}
      <Term id="free-tier" /> limits, and a what-if panel re-prices a run with different settings.
    </p>
  ),
  why: (
    <>
      <p>
        Each question costs a fraction of a cent, which feels like nothing, until a real product
        answers thousands a day. Settings that look harmless, like 10 sources instead of 5, quietly
        double the bill.
      </p>
      <p>
        <strong>Without the ledger</strong> you&apos;d find that out from an invoice. Here you see
        which settings drive cost before you choose them, and how close you are to the free limits
        that would start refusing requests.
      </p>
    </>
  ),
  inputs: [
    {
      name: "Chart model",
      what: "Which model's daily usage the two charts show. Each has its own free limits.",
    },
    {
      name: "Scale to the free quota",
      what: "On: the chart's height is the daily limit, so you see how much of it you use. Off: zoomed to your actual use.",
    },
    {
      name: "Clicking a row in Runs",
      what: "Loads that run into the What if? panel. Clicking its question opens the prompt inspector instead.",
    },
    {
      name: "What if? controls",
      what: (
        <>
          Re-price the selected run with another model, another <Term id="top-k" />, another chunk
          size, or with <Term id="cached-input">prompt caching</Term> of its fixed opening part.
        </>
      ),
    },
  ],
  steps: [
    {
      do: "Read the five tiles at the top.",
      see: "Runs, input and output tokens, cost if paid (a few cents in total) and Spent on input. Input is about two-thirds of the spend: in RAG, the sources dominate.",
    },
    {
      do: "Click a chat · rag row in the Runs table, then set top 10 in What if?.",
      see: "For a 5-source run of 1,845 input tokens: about 3,591 input tokens (+95%) and +82% cost. Twice the sources, nearly twice the bill.",
    },
    {
      do: "Keep top 10 and pick 1000-token chunks.",
      see: "About 10,679 input tokens: +479% input and +413% cost, about $3.29 per 1,000 questions instead of $0.64.",
    },
    {
      do: "Put it back to top 5 and chunks as retrieved, then turn on Cache system prompt + history.",
      see: "Only about 73 tokens get cached and the cost drops 3%. The fixed part of a RAG prompt is tiny; the sources change every question, so they can't be cached.",
    },
    {
      do: "Switch the chart between Gemini 3.5 Flash-Lite and Gemini 3.8 Flash with the quota scale on.",
      see: "Flash-Lite's bars barely show under a 500-a-day line. Flash's limit is 20 a day, so the eval judge's calls nearly fill it.",
    },
  ],
  reading: [
    {
      name: "Cost if paid",
      what: (
        <>
          At each provider&apos;s list price (<Term id="cost-if-paid" />
          ). Your real cost is $0 on the free tiers.
        </>
      ),
    },
    {
      name: "Spent on input / output / embeddings",
      what: (
        <>
          Where the money goes. <Term id="input-output-tokens">Output</Term> costs more per token,
          but input wins on volume.
        </>
      ),
    },
    {
      name: "Requests per day chart",
      what: "One bar per day (Pacific time, when Gemini's quota resets), split into chat and eval requests, with the free limit as a line.",
    },
    {
      name: "Tokens per day chart",
      what: "Input, cached input, output and eval tokens per day.",
    },
    {
      name: "Busiest minute",
      what: (
        <>
          The most requests and tokens in any one minute, against the per-minute limits. Those are
          the <Term id="rate-limit">limits</Term> a burst actually hits.
        </>
      ),
    },
    {
      name: "Runs table",
      what: (
        <>
          Source says where a run came from: chat · rag, chat (no documents), sdk, inspector (a
          re-run) or debugger (a replay). Embed is the question&apos;s embedding tokens (– when
          cached). <Term id="ttft" /> and Total are in seconds.
        </>
      ),
    },
  ],
  pros: [
    "Every number comes from the provider's own usage report, not a guess.",
    "What-if pricing lets you see a setting's cost without running anything.",
    "Shows how far you are from the free limits before you hit them.",
  ],
  cons: [
    "Paid prices change. The ones here were copied from each provider's price page when the app was built, and live in lib/config.ts.",
    "What-if can't predict output length; it holds output constant.",
    "It only sees what goes through this app. Usage from the same API keys elsewhere still counts against the free limits but isn't shown.",
  ],
  surprises: [
    "Cached input shows 0 almost everywhere. Gemini only caches long repeated openings, and RAG prompts change with every question.",
    '"0 thinking (logged from Phase 3)": thinking tokens weren\'t recorded before Phase 3, and the default models are set to think minimally.',
    "The day boundary is midnight Pacific, not your local midnight, because that's when the quota resets.",
  ],
  lessons: ["tokens", "caching-and-cost"],
  next: { href: "/evals", label: "Evals: is it actually getting better?" },
};
