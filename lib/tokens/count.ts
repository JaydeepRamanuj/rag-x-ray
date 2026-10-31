import { countTokens as countO200k } from "gpt-tokenizer/encoding/o200k_base";

/**
 * A fast local token estimate. Gemini's tokenizer isn't published, so chunk
 * sizes and document sizes use OpenAI's o200k vocabulary as a stand-in. For
 * English prose the two land within roughly 10% of each other; the exact
 * count for a call comes back from the provider in its usage report.
 */
export function estimateTokens(text: string): number {
  return countO200k(text);
}
