import { embeddingModels, estimateCostUsd, type ChatModel, type ProviderId } from "@/lib/config";

/** What we know about a past run, in the units the what-if needs. */
export type RunForWhatIf = {
  provider: ProviderId;
  /** Exact, from the provider's usage report. */
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  embedTokens: number;
  /** Local estimates (o200k) of the whole prompt, its sources, and the stable prefix. */
  promptEstimate: number;
  sourceEstimate: number;
  sourceCount: number;
  /** System prompt + history: the part that repeats between requests. */
  prefixEstimate: number;
};

export type Scenario = {
  model: ChatModel;
  topK: number;
  /** Tokens per chunk. Undefined keeps the run's actual average chunk size. */
  chunkSize?: number;
  /** Price the stable prefix as cached input, as provider prompt caching would. */
  cachePrefix: boolean;
};

export type WhatIfResult = {
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
  chatUsd: number;
  embedUsd: number;
  totalUsd: number;
  /** True when the token counts came from a different tokenizer's ratio. */
  approximate: boolean;
};

/** Query embeddings are billed per input token; the API reports no usage, so it's our estimate. */
export function embedCostUsd(tokens: number): number {
  return (tokens * embeddingModels.gemini.price.input) / 1_000_000;
}

/**
 * Re-prices a past run under different settings.
 *
 * The work happens in local-estimate units, then converts to the provider's
 * tokens with the ratio this run actually showed (exact input / our
 * estimate). That ratio absorbs the chat template and the tokenizer
 * difference, but only for the provider that served the run. For another
 * provider it falls back to 1, so the result is marked approximate.
 *
 * Output tokens are held constant: a different model or prompt would write a
 * different answer, but there's no way to know its length without running it.
 */
export function whatIfCost(run: RunForWhatIf, scenario: Scenario): WhatIfResult {
  const sameProvider = scenario.model.provider === run.provider;
  const ratio = sameProvider && run.promptEstimate > 0 ? run.inputTokens / run.promptEstimate : 1;

  const avgChunk = run.sourceCount > 0 ? run.sourceEstimate / run.sourceCount : 0;
  // A run without retrieval has no sources to scale, whatever top-k says.
  const sources = run.sourceCount > 0 ? scenario.topK * (scenario.chunkSize ?? avgChunk) : 0;
  const estimate = run.promptEstimate - run.sourceEstimate + sources;
  const inputTokens = Math.max(0, Math.round(estimate * ratio));

  const cachedTokens = scenario.cachePrefix
    ? Math.min(inputTokens, Math.round(run.prefixEstimate * ratio))
    : sameProvider
      ? Math.min(inputTokens, run.cachedTokens)
      : 0;

  const chatUsd = estimateCostUsd(scenario.model.price, {
    inputTokens,
    cachedTokens,
    outputTokens: run.outputTokens,
  });
  const embedUsd = embedCostUsd(run.embedTokens);
  return {
    inputTokens,
    cachedTokens,
    outputTokens: run.outputTokens,
    chatUsd,
    embedUsd,
    totalUsd: chatUsd + embedUsd,
    approximate: !sameProvider,
  };
}
