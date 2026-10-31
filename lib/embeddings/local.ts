import path from "node:path";

import { embeddingModels } from "@/lib/config";

/**
 * all-MiniLM-L6-v2 running inside this Node process with Transformers.js
 * (ONNX Runtime underneath). No API, no quota, no network after the first
 * download: an embedding model is just a function from text to numbers.
 *
 * The pipeline() helper would do all of this in one call, but it truncates
 * at the tokenizer's 512-token limit, while the model was trained on at most
 * 256. Calling the tokenizer and model directly lets us cap at 256 like the
 * reference sentence-transformers code does, and makes the pooling visible.
 */

type Loaded = {
  tokenizer: (
    texts: string[],
    options: { padding: boolean; truncation: boolean; max_length: number },
  ) => Record<string, unknown> & { attention_mask: TensorLike };
  model: (inputs: Record<string, unknown>) => Promise<{ last_hidden_state: TensorLike }>;
};
type TensorLike = { dims: number[]; data: ArrayLike<number | bigint> };

let loading: Promise<Loaded> | undefined;

function load(): Promise<Loaded> {
  loading ??= (async () => {
    const { AutoModel, AutoTokenizer, env } = await import("@huggingface/transformers");
    // The model is downloaded from Hugging Face once and kept here. On
    // Vercel only /tmp is writable, and it's emptied between cold starts.
    env.cacheDir = process.env.VERCEL
      ? "/tmp/transformers"
      : path.join(process.cwd(), ".cache", "transformers");
    const id = embeddingModels.local.id;
    const [tokenizer, model] = await Promise.all([
      AutoTokenizer.from_pretrained(id),
      AutoModel.from_pretrained(id, { dtype: "fp32" }),
    ]);
    return { tokenizer, model } as unknown as Loaded;
  })();
  // A failed load (no network, package missing) shouldn't stick forever.
  loading.catch(() => (loading = undefined));
  return loading;
}

/** Texts per forward pass. Bigger is faster until memory runs out. */
const BATCH = 32;

/** Unit-length 384-dim vectors, one per text. */
export async function embedLocal(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const { tokenizer, model } = await load();
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const inputs = tokenizer(texts.slice(i, i + BATCH), {
      padding: true,
      truncation: true,
      max_length: embeddingModels.local.maxInputTokens,
    });
    const { last_hidden_state } = await model(inputs);
    out.push(...meanPool(last_hidden_state, inputs.attention_mask));
  }
  return out;
}

/**
 * The model outputs one vector per token. A sentence embedding is their
 * average, skipping padding (attention mask 0), then scaled to length 1 so a
 * dot product is the cosine similarity.
 */
export function meanPool(hidden: TensorLike, mask: TensorLike): number[][] {
  const [batch, seq, dims] = hidden.dims;
  const vectors: number[][] = [];
  for (let b = 0; b < batch; b++) {
    const sum = new Array<number>(dims).fill(0);
    let tokens = 0;
    for (let t = 0; t < seq; t++) {
      if (Number(mask.data[b * seq + t]) === 0) continue;
      tokens++;
      const offset = (b * seq + t) * dims;
      for (let d = 0; d < dims; d++) sum[d] += Number(hidden.data[offset + d]);
    }
    const mean = sum.map((x) => x / Math.max(1, tokens));
    const norm = Math.hypot(...mean) || 1;
    vectors.push(mean.map((x) => x / norm));
  }
  return vectors;
}

/** Whether the local model can run here, and why not if it can't. */
export async function localEmbeddingsStatus(): Promise<
  { ok: true } | { ok: false; reason: string }
> {
  try {
    await load();
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

// The chunking lab re-runs semantic splitting on every slider move, and
// most sentence windows are the same each time. Local vectors are cheap but
// not free (~3 s for 400 windows on a laptop), so recent ones are memoised.
const memo = new Map<string, number[]>();
const MEMO_LIMIT = 20_000;

/** embedLocal with an in-process memo in front. Lost on restart, which is fine. */
export async function embedLocalMemo(texts: string[]): Promise<number[][]> {
  const missing = [...new Set(texts.filter((t) => !memo.has(t)))];
  const vectors = await embedLocal(missing);
  missing.forEach((t, i) => memo.set(t, vectors[i]));
  // Map keeps insertion order, so the first keys are the oldest.
  for (const key of memo.keys()) {
    if (memo.size <= MEMO_LIMIT) break;
    memo.delete(key);
  }
  return texts.map((t) => memo.get(t) ?? []);
}
