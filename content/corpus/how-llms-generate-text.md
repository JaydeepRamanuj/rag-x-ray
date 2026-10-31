# How a Large Language Model Actually Generates Text

A large language model (LLM) does one thing: given a sequence of tokens, it predicts a probability for every possible next token. Everything else you see, from chat to code to tool calls, is built by running that one step in a loop. This document walks through that loop from raw text to the final word on screen.

## Step 1: Text becomes tokens

A model never sees letters or words. It sees integers called **token IDs**. A **tokenizer** splits text into pieces from a fixed **vocabulary** and maps each piece to its ID.

Most modern tokenizers use **byte-pair encoding (BPE)** or a close relative such as SentencePiece's unigram model. BPE starts from single bytes and repeatedly merges the most frequent adjacent pair into a new vocabulary entry, until the vocabulary reaches a target size. Common words end up as one token ("the", " retrieval"), rare words split into several ("pgvector" might become "pg", "vector"), and any string at all can still be encoded because single bytes are always in the vocabulary.

Typical vocabulary sizes are between 32,000 and about 260,000 tokens. Larger vocabularies make text shorter in tokens (cheaper and faster) but make the embedding table and the output layer bigger.

Practical consequences:

- **One token is roughly four characters of English**, or about three quarters of a word. Other languages and code often need more tokens for the same meaning.
- **Prices, context limits and rate limits are all counted in tokens**, not words or characters.
- Models are weak at tasks that depend on characters inside a token, such as counting the letters in a word or reversing a string, because they never saw those letters directly.
- Numbers are tokenized unevenly, which is one reason plain arithmetic was unreliable in early models.

## Step 2: Tokens become vectors (embeddings)

Each token ID is looked up in an **embedding matrix**, a table with one row per vocabulary entry. The row is a vector of a few thousand numbers (the model's **hidden size**, for example 4,096). At the start these vectors are random; training moves them so that tokens used in similar ways end up close together.

A token's embedding alone says nothing about where it sits in the sentence. The model also needs **position information**. The original Transformer added fixed sine and cosine patterns to each embedding. Most current models use **rotary position embeddings (RoPE)**, introduced in 2021, which rotate parts of the query and key vectors by an angle that depends on position. RoPE encodes relative distance between tokens and can be stretched, with techniques such as YaRN, to longer contexts than the model was trained on.

## Step 3: The Transformer layers

The vectors then pass through a stack of identical **Transformer blocks**, often 32 to 120 of them. Each block has two main parts.

### Self-attention

**Self-attention** lets every token look at every earlier token and pull in information from the ones that matter. For each token the model computes three vectors by multiplying its current vector by learned weight matrices:

- a **query** (Q): what this token is looking for,
- a **key** (K): what this token offers to others,
- a **value** (V): the information it passes on if chosen.

The attention score between two tokens is the dot product of one token's query with the other's key, divided by the square root of the key dimension to keep the numbers stable. A **softmax** turns the scores into weights that sum to one, and the output is the weighted sum of the value vectors. In a formula: `Attention(Q, K, V) = softmax(QKᵀ / √d) · V`.

In a decoder-only model (GPT, Llama, Gemini, Claude and almost every chat model), a **causal mask** stops a token from attending to tokens after it. That is what makes the model a next-token predictor: position 10 can only use positions 1 to 10.

**Multi-head attention** runs many attention operations in parallel (for example 32 heads), each with its own Q, K and V projections, so different heads can track different relationships such as syntax, coreference or which word a pronoun refers to. Newer models use **grouped-query attention (GQA)**, where several query heads share one key/value head, to cut memory use during generation.

Attention compares every token with every other token, so its cost grows with the **square of the sequence length**. Doubling the context roughly quadruples the attention work. This quadratic cost is the main reason long context windows are expensive, and it drove work such as **FlashAttention** (2022), which computes exact attention in tiles that fit in fast on-chip GPU memory instead of writing the full score matrix to slower memory.

### The feed-forward network

After attention, each token's vector goes through a **feed-forward network (FFN)**, also called the MLP: two or three large matrix multiplications with a non-linear activation (SwiGLU in most current models). Attention moves information between positions; the FFN transforms it within a position. A large share of a model's parameters, and much of its stored factual knowledge, sits in these FFN layers.

Each part is wrapped with a **residual connection** (the input is added back to the output) and **normalization** (LayerNorm or RMSNorm). Residual connections let gradients flow through very deep stacks during training, which is what makes 100-layer models trainable at all.

### Mixture of experts

Many frontier and open models are **mixture-of-experts (MoE)** models. The single FFN in each block is replaced by many smaller "expert" FFNs and a small **router** that sends each token to only a few of them, for example 2 out of 64. The model can then hold far more parameters in total while each token only pays for the few experts it uses. The model's **total parameters** and **active parameters** differ: a model might have 600 billion parameters in total but use about 37 billion per token.

## Step 4: From the last vector to a probability for every token

After the final block, the vector at the **last position** is multiplied by an output matrix (the **unembedding** or **LM head**) to produce one raw score, called a **logit**, for every token in the vocabulary. A softmax turns the logits into a probability distribution. For the prompt "The capital of France is", the token " Paris" might get 0.92, " the" 0.02, and so on across all vocabulary entries.

This is the entire output of one forward pass: a probability distribution over the next token. The model does not plan a sentence or look anything up. Anything that looks like planning emerges from the patterns learned in training.

## Step 5: Sampling the next token

A **decoding strategy** picks one token from the distribution.

- **Greedy decoding** always picks the most likely token. It is deterministic but tends to repeat itself.
- **Temperature** divides the logits before the softmax. A temperature below 1 sharpens the distribution (more predictable); above 1 flattens it (more varied). Temperature 0 is treated as greedy.
- **Top-k sampling** keeps only the k most likely tokens, then samples among them.
- **Top-p (nucleus) sampling** keeps the smallest set of tokens whose probabilities add up to p, for example 0.9, then samples among them. The set grows when the model is unsure and shrinks when it is confident.

For RAG answers a low temperature (around 0 to 0.3) is common, because you want the model to stick to the sources rather than be creative. Even at temperature 0, many hosted APIs are not perfectly deterministic, because batching and floating-point order on GPUs change results slightly.

## Step 6: The loop (autoregressive generation)

The chosen token is appended to the input and the whole process runs again to pick the next one. This is **autoregressive generation**: every output token costs one forward pass. Generation stops when the model emits a special **end-of-sequence** token, hits a stop sequence, or reaches the maximum output length you set.

### Prefill and decode

Serving systems split generation into two phases:

- **Prefill**: the whole prompt is processed in one parallel pass. GPUs are very good at this, so input tokens are cheap and fast. The time until the first output token appears is called **time to first token (TTFT)** and is dominated by prefill plus queueing.
- **Decode**: output tokens are produced one at a time. Each step is small, so decode is limited by memory bandwidth rather than compute. This is why output tokens are priced several times higher than input tokens on almost every API.

### The KV cache

Without help, step 500 of decoding would recompute keys and values for all 499 earlier tokens. The **KV cache** stores each token's key and value vectors from every layer so they are computed once. The cache grows linearly with context length and is often the main memory cost of serving long conversations. Grouped-query attention, quantized caches and paged memory management (PagedAttention, used by vLLM) all exist to shrink or organize it.

**Prompt caching**, offered by most API providers, is the same idea across requests: if a new request starts with the same prefix as an earlier one (a long system prompt or the same documents), the provider reuses the stored KV cache for that prefix and charges a much lower rate for those cached input tokens.

### Streaming

Because tokens are produced one at a time, APIs can send each one as soon as it exists. Most providers stream with **Server-Sent Events (SSE)**: a long-lived HTTP response where each event is a `data:` line followed by a blank line. Streaming does not make the full answer faster, but the user sees the first words after the TTFT instead of waiting for the last token.

## How the model learned to do this: training

### Pretraining

**Pretraining** teaches next-token prediction on a huge text corpus, now commonly 10 to 30 trillion tokens of web pages, books, code and papers. For each position, the model predicts the next token and is penalized with **cross-entropy loss**: the negative log of the probability it gave to the true next token. **Backpropagation** computes how each parameter contributed to the error, and an optimizer (usually AdamW) nudges every parameter slightly in the direction that lowers the loss. This repeats for trillions of tokens across thousands of GPUs for weeks or months.

Nobody labels this data. The text supplies its own labels, which is why the approach is called **self-supervised learning** and why it scales to the whole internet.

A pretrained **base model** is a document completer, not an assistant. Ask it a question and it may continue with more questions, because that is a likely continuation of a list of questions.

### Scaling laws

In 2020, OpenAI's Kaplan et al. showed that loss falls smoothly and predictably as a power law when you increase parameters, data and compute together. In 2022, DeepMind's **Chinchilla** paper corrected the balance: for a fixed compute budget, models had been too large and trained on too little data. Chinchilla, at 70 billion parameters trained on 1.4 trillion tokens, beat the 280-billion-parameter Gopher. Its rule of thumb is about **20 training tokens per parameter** for compute-optimal training. Current models are often trained far beyond that ratio, because a smaller model trained longer is cheaper to serve.

### Post-training

**Post-training** turns the base model into an assistant.

1. **Supervised fine-tuning (SFT)**, also called instruction tuning: training on tens of thousands to millions of example conversations written or curated by people, so the model learns the chat format and to answer rather than continue.
2. **Preference tuning**: people (or a model) compare two answers and pick the better one. In **RLHF** (reinforcement learning from human feedback), a separate **reward model** learns to predict those preferences and the language model is optimized with reinforcement learning (classically PPO) to score highly. **DPO** (direct preference optimization, 2023) reaches a similar result by training directly on the preference pairs with no separate reward model or RL loop.
3. **Reinforcement learning with verifiable rewards**: for math and code, the reward comes from checking the answer or running tests. This is how **reasoning models** were trained to produce long chains of intermediate "thinking" tokens before answering. OpenAI's o1 (September 2024) popularized the approach, and DeepSeek-R1 (January 2025) published an open recipe using GRPO, a PPO variant that compares a group of sampled answers instead of training a separate value model.

Reasoning tokens are ordinary output tokens. They are billed as output and count against the maximum output length, which is why a low output cap can cut off a reasoning model before it writes any visible answer.

### Chat templates and system prompts

A chat API looks like a list of messages with roles (system, user, assistant, tool), but the model still sees one token sequence. A **chat template** flattens the messages into that sequence with special tokens marking where each role's turn begins and ends. The **system prompt** is simply the first part of the sequence; the model was trained to give it extra weight, not forced to obey it.

## Why models hallucinate

A **hallucination** is a fluent, confident statement that is false. It follows directly from how generation works:

- The model is trained to produce **likely** text, not true text. A plausible-sounding citation is a likely continuation even if the paper does not exist.
- Knowledge is stored **implicitly** in billions of weights, compressed and lossy. Rare facts, such as a minor paper's exact title or a small company's founding year, are poorly stored.
- The model has a **knowledge cutoff**: it knows nothing that happened after its training data was collected.
- It has never seen your **private data**: your company wiki, your codebase, your PDFs.
- Post-training can reward confident answers over "I don't know" unless the training data specifically rewards abstaining.

These limits are exactly what **retrieval-augmented generation (RAG)** addresses: instead of hoping the fact is in the weights, you put the relevant text in the prompt at question time and ask the model to answer from it.

## The context window

The **context window** is the maximum number of tokens (prompt plus output) a model can handle in one call. It grew from 512 tokens in BERT and 2,048 in GPT-3 to 128,000 tokens and beyond, with several current models accepting one million or more.

A large window does not mean equal attention to every part of it. The 2023 paper **"Lost in the Middle"** (Liu et al.) showed that models use information at the start and end of a long context better than information buried in the middle. Long prompts also cost more, add latency through longer prefill, and dilute the relevant passage with noise. This is why RAG still matters with long-context models: sending the five right passages often beats sending the whole library.

## Summary

1. A tokenizer turns text into token IDs.
2. An embedding table turns IDs into vectors, with position information added.
3. A stack of Transformer blocks (attention plus feed-forward) mixes information across tokens.
4. The last position's vector becomes a probability for every vocabulary token.
5. A decoding strategy (temperature, top-p) samples one token.
6. The token is appended and the loop repeats, with the KV cache avoiding repeated work.

Pretraining on trillions of tokens gives the model its knowledge and fluency; post-training (SFT, preference tuning, RL) makes it a helpful assistant. Hallucinations, knowledge cutoffs and the lack of private data are built-in limits of this design, and they are the reason retrieval, tools and agents exist.
