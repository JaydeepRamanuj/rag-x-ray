# From Rules to Transformers: The Problems That Held Language AI Back, and How Each Was Solved

Language models did not appear in 2022. ChatGPT was the moment they became mainstream, but it sat on top of seventy years of attempts, each of which hit a specific wall. This document follows those walls in order, because each modern technique is easiest to understand as the fix for one of them.

## Era 1: Hand-written rules (1950s to 1980s)

The first approach was to write the rules of language by hand. Early machine translation systems, such as the 1954 Georgetown–IBM experiment that translated about sixty Russian sentences into English, used dictionaries and grammar rules written by linguists. **ELIZA** (1966, Joseph Weizenbaum at MIT) imitated a therapist by matching keywords and rearranging the user's sentence into a question.

**The problem: language has too many exceptions.** Every rule needed more rules for its exceptions, and the systems broke on anything their authors had not anticipated. The 1966 **ALPAC report** concluded that machine translation had not delivered and US funding dropped sharply, one of the causes of the first "AI winter".

**What fixed it:** learning the patterns from data instead of writing them down.

## Era 2: Statistical language models (1990s to early 2010s)

Researchers at IBM in the late 1980s and 1990s showed that translation and speech recognition worked better when probabilities were estimated from large amounts of text. A **language model** in this era was usually an **n-gram model**: it estimated the probability of a word from the previous n−1 words by counting. A trigram model predicts "Paris" after "capital of" by counting how often "capital of Paris"-style sequences appeared.

**Problem 1: data sparsity.** Most possible word sequences never appear in any corpus, even a huge one. A 5-gram model has seen almost none of the 5-word sequences it will meet. Smoothing techniques such as Kneser–Ney redistributed probability to unseen sequences, but they could not truly generalize.

**Problem 2: no notion of similarity.** To an n-gram model, "cat" and "dog" are as different as "cat" and "carburettor". Learning that "the cat sat" is likely tells it nothing about "the dog sat".

**Problem 3: very short memory.** Counting longer histories makes sparsity explode, so practical models looked back only 3 to 5 words.

**What fixed it:** representing words as dense vectors learned by neural networks.

## Era 3: Word embeddings (2003 to 2017)

Yoshua Bengio's 2003 **neural probabilistic language model** learned a vector for each word together with a network that predicted the next word. Words that appear in similar contexts got similar vectors, so knowledge about "cat" transferred to "dog". This idea is the **distributional hypothesis**, summarized by J.R. Firth in 1957 as "you shall know a word by the company it keeps".

The breakthrough in practice was **word2vec** (2013, Tomas Mikolov and colleagues at Google). It trained shallow networks very cheaply on billions of words, using two variants: **CBOW** (predict a word from its neighbours) and **skip-gram** (predict the neighbours from a word). The vectors had striking structure: `vector("king") − vector("man") + vector("woman")` landed close to `vector("queen")`. **GloVe** (2014, Stanford) reached similar vectors from global co-occurrence counts.

**The problem: one vector per word, regardless of context.** "Bank" had the same vector in "river bank" and "bank account". Word vectors also said nothing about word order or sentence meaning on their own.

**What fixed it:** models that read the whole sequence and produce a vector for each word in context.

## Era 4: Recurrent neural networks (2010s)

A **recurrent neural network (RNN)** reads a sentence one token at a time and keeps a **hidden state**, a vector that is updated at each step and carries a summary of everything read so far. In principle it has unlimited memory; in practice it did not.

**Problem 1: vanishing and exploding gradients.** Training an RNN means backpropagating the error through every time step. The gradient is multiplied by the same weight matrix at each step, so over 50 or 100 steps it shrinks towards zero (vanishing) or blows up (exploding). The network could not learn dependencies between words far apart. Sepp Hochreiter described the vanishing gradient problem in his 1991 diploma thesis.

**The partial fix: LSTM and GRU.** The **long short-term memory (LSTM)** network (Hochreiter and Schmidhuber, 1997) adds a separate cell state and three learned **gates** (input, forget, output) that decide what to write, keep and read. Because the cell state is updated by addition rather than repeated multiplication, gradients survive many more steps. The **gated recurrent unit (GRU)** (Cho et al., 2014) is a simpler variant with two gates. LSTMs powered Google Translate, Siri and most speech recognition in the mid-2010s.

**Problem 2: the fixed-size bottleneck.** In **sequence-to-sequence** models (Sutskever, Vinyals and Le, 2014), an encoder RNN read the whole source sentence and squeezed it into one final hidden state, which a decoder RNN then expanded into the translation. One vector of a few hundred numbers had to hold an entire sentence, and quality fell off sharply for long sentences.

**Problem 3: no parallelism.** Step 100 needs the hidden state from step 99, so an RNN processes tokens strictly one after another. GPUs, which are fast because they do thousands of operations at once, sat mostly idle. Training on much larger datasets was too slow.

## The first fix: attention (2014)

**Bahdanau, Cho and Bengio (2014)** removed the bottleneck. Instead of using only the encoder's last hidden state, the decoder could look back at **all** encoder states at every step and compute a weighted average, with the weights learned from how relevant each source word was to the word being produced. This was **attention**. Translation of long sentences improved immediately, and the attention weights even showed sensible word alignments between languages.

Attention was still bolted onto an RNN, so the parallelism problem remained.

## The real breakthrough: the Transformer (2017)

The paper **"Attention Is All You Need"** (Vaswani et al., Google, June 2017) asked what happens if you drop recurrence entirely and keep only attention. The **Transformer** processes all tokens of a sequence at once with **self-attention**: every token computes its relationship with every other token in a single parallel step, and stacked layers build up richer representations.

It solved the three RNN problems together:

- **Long-range dependencies:** any two tokens are connected directly in one attention step, instead of through dozens of recurrent steps, so gradients do not have to survive a long chain.
- **The bottleneck:** there is no single summary vector; every token keeps its own vector at every layer.
- **Parallelism:** during training, all positions are computed at once, so GPUs and TPUs are used fully. This made it practical to train on vastly more data.

The original Transformer was an encoder–decoder for translation and set a new state of the art on English–German and English–French with less training cost than earlier systems. Its cost is attention's quadratic growth with sequence length, which long-context research has been working on ever since.

## Pretraining and transfer learning (2018 to 2019)

Two 2018 models showed that one Transformer pretrained on plain text could be adapted to almost any language task.

- **GPT** (OpenAI, June 2018) used the **decoder** half and was pretrained to predict the next token, then fine-tuned for each task.
- **BERT** (Google, October 2018) used the **encoder** half and was pretrained with **masked language modelling**: hide 15% of the tokens and predict them from both sides. BERT topped most language-understanding benchmarks and was soon used in Google Search. Its descendants are still the backbone of embedding models and rerankers, because reading both directions suits understanding a passage.

**The problem this solved: every task needed its own labelled dataset.** Before, a sentiment classifier, a question-answering system and a named-entity tagger were each trained from scratch on labelled data, which is expensive. With pretraining, the expensive part (learning language) happens once on unlabelled text, and each task needs only a small fine-tuning set.

**GPT-2** (February 2019, 1.5 billion parameters) generated coherent multi-paragraph text. OpenAI initially withheld the full model over misuse concerns and released it in stages through November 2019.

## Scale and in-context learning (2020)

**GPT-3** (May 2020, 175 billion parameters, trained on about 300 billion tokens) showed **in-context learning**: given a few examples in the prompt ("few-shot prompting"), it could perform a new task with no fine-tuning at all. The same year, Kaplan et al. published **scaling laws** showing that loss improves predictably with more parameters, data and compute. Bigger became a strategy, not a gamble.

**The new problem: a raw pretrained model is not a helpful assistant.** GPT-3 completed documents. Asked a question, it might answer, continue with five more questions, or produce something toxic it had learned from the web. It also stated falsehoods with full confidence.

## Alignment and ChatGPT (2022)

OpenAI's **InstructGPT** paper (published March 2022) applied **reinforcement learning from human feedback (RLHF)**: fine-tune on example answers written by people, train a reward model on human rankings of answers, then optimize the language model against that reward. Labellers preferred answers from the 1.3-billion-parameter InstructGPT over the 175-billion-parameter GPT-3. Following instructions turned out to matter more than raw size for usefulness.

**ChatGPT** launched on **30 November 2022** as a free research preview built on this approach. It reached an estimated 100 million users within about two months, the fastest-growing consumer app at the time. The technology was not new; what changed was a chat interface anyone could use and a model tuned to be helpful in conversation.

## What came after, and the problems each step addressed

| Problem                                               | Fix                                                                                                                                                                       | When      |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Models only know their training data and invent facts | **Retrieval-augmented generation (RAG)**: fetch relevant documents and put them in the prompt (Lewis et al., 2020; mainstream from 2023)                                  | 2020–2023 |
| Models cannot act or fetch live data                  | **Tool calling / function calling**: the model emits a structured request, your code runs it and returns the result (ReAct paper 2022; OpenAI function calling June 2023) | 2022–2023 |
| Every app wires up tools differently                  | **Model Context Protocol (MCP)**, an open standard for connecting models to tools and data, released by Anthropic in November 2024                                        | 2024      |
| Short context windows                                 | Better position encodings (RoPE scaling), FlashAttention, and context windows from 4k up to 1M+ tokens                                                                    | 2023–2025 |
| Training and serving costs                            | Mixture-of-experts models, quantization (8-bit and 4-bit weights), distillation into small models                                                                         | 2023–2025 |
| Weak multi-step reasoning                             | **Reasoning models** trained with reinforcement learning to think step by step before answering (OpenAI o1, Sept 2024; DeepSeek-R1, Jan 2025)                             | 2024–2025 |
| Single answers are not enough for long tasks          | **Agents**: models in a loop that plan, call tools, observe results and continue, built with frameworks such as LangGraph                                                 | 2024–2026 |

## The pattern

Each era's fix was a better way of representing context:

1. Rules: context is whatever the programmer anticipated.
2. N-grams: context is the last few words, counted.
3. Word vectors: context shapes a word's single fixed meaning.
4. RNNs: context is squeezed through one running hidden state.
5. Attention: context is every earlier position, weighted by relevance.
6. Transformers with retrieval and tools: context is anything you can fetch and fit in the window.

RAG, the subject of this app, is the latest step in that line. The model's weights hold general language skill; the prompt holds the specific facts it needs right now.
