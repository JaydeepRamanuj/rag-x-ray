import { z } from "zod";

import { allChatModels, getChatModel } from "@/lib/config";
import { getProvider } from "@/lib/llm";

const bodySchema = z.object({
  model: z.enum(allChatModels.map((m) => m.id) as [string, ...string[]]),
  // One entry per prompt part. Caps keep a public URL from hammering the API.
  texts: z.array(z.string().max(50_000)).min(1).max(30),
});

/**
 * Counts each text with the model's own tokenizer, so the prompt inspector
 * can put the provider's count next to our local o200k estimate. Each text is
 * counted as one user message on its own, so it includes that message's own
 * small overhead, which is why the parts can add up to slightly more than the
 * run's real input.
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }
  const model = getChatModel(parsed.data.model);
  const provider = getProvider(model.provider);

  try {
    const counts = await Promise.all(
      parsed.data.texts.map((text) =>
        // An empty part costs nothing; Gemini rejects empty contents anyway.
        text
          ? provider.countTokens({ model, messages: [{ role: "user", content: text }] })
          : Promise.resolve({ tokens: 0, exact: true, method: "" }),
      ),
    );
    const method = counts.find((c) => c.method)?.method ?? "";
    return Response.json({
      counts: counts.map((c) => c.tokens),
      exact: counts.every((c) => c.exact),
      method,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
