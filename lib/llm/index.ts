import type { ProviderId } from "@/lib/config";

import { gemini } from "./gemini";
import { groq } from "./groq";
import type { LlmProvider } from "./types";

// OpenRouter is optional and not wired up yet: it speaks the same dialect as
// Groq, so adding it is mostly a new URL and key.
const providers: Partial<Record<ProviderId, LlmProvider>> = { gemini, groq };

export function getProvider(id: ProviderId): LlmProvider {
  const provider = providers[id];
  if (!provider) throw new Error(`Provider not available: ${id}`);
  return provider;
}

export type * from "./types";
