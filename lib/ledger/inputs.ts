import type { Run } from "@/lib/db/runs";
import type { ProviderId } from "@/lib/config";
import type { ChatMessage } from "@/lib/llm/types";
import { promptParts, splitPrompt } from "@/lib/prompt/anatomy";
import type { RunForWhatIf } from "@/lib/tokens/cost";
import { estimateTokens } from "@/lib/tokens/count";

/**
 * Measures a saved run for the what-if panel. Server-only: it tokenizes the
 * prompt locally, and the tokenizer's vocabulary is too big to ship to the
 * browser. Runs without a usage report (errors) can't be re-priced.
 */
export function runForWhatIf(run: Run): RunForWhatIf | null {
  if (run.inputTokens == null || run.outputTokens == null) return null;
  const split = splitPrompt(run.finalPrompt as ChatMessage[], { question: run.question });
  const parts = promptParts(split, estimateTokens);
  const sum = (kinds: string[]) =>
    parts.filter((p) => kinds.includes(p.kind)).reduce((s, p) => s + p.tokens, 0);
  return {
    provider: (run.config as { provider: ProviderId }).provider,
    inputTokens: run.inputTokens,
    outputTokens: run.outputTokens,
    cachedTokens: run.cachedTokens ?? 0,
    embedTokens: run.embedTokens ?? 0,
    promptEstimate: sum(["system", "history", "framing", "source", "question", "message"]),
    sourceEstimate: sum(["source"]),
    sourceCount: parts.filter((p) => p.kind === "source").length,
    prefixEstimate: sum(["system", "history"]),
  };
}
