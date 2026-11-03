# Lesson FAQs: draft for review

A short FAQ for each lesson: what a learner is likely to wonder _after_ reading it. Each question has a one-line sketch of its answer. The final answers will be 2–4 sentences and link to the lesson, tool or code they rely on.

How the questions were picked:

- **Not repeats.** If the lesson or its Interview angle already answers a question, it's left out.
- **Practical over academic.** "What happens if…", "Should I…", "Why does the app…".
- **Honest about limits.** Where this app doesn't do something (OCR, query rewriting, local reranking), the FAQ says so.

Answers marked **(check)** rely on a fact I still need to confirm before writing the final text.

## 0. Start here

1. **Is RAG the same as fine-tuning? When would I use each?** Fine-tuning changes how a model writes. RAG gives it facts you can update and cite. Use RAG for knowledge, and fine-tuning for style or format.
2. **Context windows are huge now. Why not paste every document into the prompt?** You'd pay for every token on every question, wait longer, and get worse recall in the middle of a long prompt. It's fine for one short file.
3. **Does RAG stop hallucinations completely?** No. It makes them rarer and easier to catch, because every claim should point to a source you can open. See Lessons 9 and 10.
4. **What happens if my documents don't contain the answer?** The model is told to say so. Lesson 13's run shows it doing exactly that for half a question.
5. **Where does my data go when I upload or ask something?** Text goes to Gemini (embeddings and answers), and optionally to Cohere (rerank) and Groq. Vectors and runs are stored in Neon, and caches in Upstash. **(check)** each provider's free-tier data-use terms.
6. **Do I need maths or machine-learning background?** No. The lessons explain each idea in plain words, and the maths (cosine, RRF, MRR) is one line each, with worked numbers.
7. **Which order should I read the lessons in?** The tour order, then Lessons 1–13 in number order. Each one builds on the stage before it.

## 1. How an LLM API call works

1. **If the model has no memory, how do chat apps "remember" me between chats?** A product feature: the app stores notes about you and adds them to the prompt. The model itself still starts empty on every call.
2. **What happens when a conversation outgrows the context window?** The API rejects the request, or the app has to drop or summarise old turns first. This app re-sends the history as it is.
3. **Is temperature 0 fully deterministic?** Nearly, not exactly. Batching and floating-point differences on the provider's GPUs can still change a token now and then.
4. **System prompt or instructions in the first user message: does it matter?** Models are trained to weight the system role as standing rules. It also stays first and stable, which helps prompt caching (Lesson 11).
5. **What are top-p, stop sequences and the other parameters, and why doesn't the app set them?** A one-line meaning for each. Defaults are fine for grounded answers, so the app sets only temperature, the output cap and thinking.
6. **Can I turn thinking off completely?** Only if the model allows it. Every model here has a floor (`minimal`, `low`), which is why the app sets that floor.
7. **What do 429 and 503 errors mean? Should I retry?** 429: you're over a rate limit, so wait as long as it says. 503: the provider is busy, so retry with backoff. A wait of minutes means the daily quota is gone.
8. **Why does the app use plain `fetch` instead of each provider's SDK?** So every byte stays visible while you learn. Lesson 12 rebuilds it with a library.

## 2. Tokens and tokenisers

1. **How many tokens is a page, or 1,000 words?** For English prose, about 1,300 tokens per 1,000 words (a token is about ¾ of a word). Code, numbers and non-English text use more.
2. **Do spaces, newlines and Markdown cost tokens?** Yes. Every character is part of some token, so pasted HTML or heavy formatting costs more than plain text.
3. **Why doesn't my local count match what I'm billed?** Different tokeniser, chat-template tokens, system prompt, and hidden thinking. The app marks local counts `exact: false`.
4. **Are embedding tokens counted and priced the same way?** Counted by the embedding model's own tokeniser, input only (there's no output), at a much lower price per million.
5. **What happens if input plus max output is bigger than the context window?** The request fails, or the answer gets cut short, depending on the provider. Budget for both.
6. **Can I see the thinking tokens I'm paying for?** Usually not the text, only the count. The stats line and the ledger show it.
7. **Why are cached input tokens cheaper?** The provider skips recomputing a prefix it already processed. Lesson 11 shows when that actually happens.

## 3. Streaming

1. **Does streaming make the answer arrive faster overall?** No. The total time is about the same. You just start reading sooner (TTFT).
2. **If I press Stop, do I still pay for what was generated?** Yes, for the tokens produced before the stop reached the provider. The partial answer and its usage are saved, on Gemini.
3. **Why doesn't the browser call Gemini directly?** The API key would be exposed, and retrieval, prompt building and saving the run all happen on the server.
4. **What if the connection drops halfway through an answer?** The stream ends and the run is saved as it stands. This app doesn't resume streams. **(check)** what status a dropped (not stopped) run gets.
5. **Why does Gemini send big chunks and Groq tiny ones?** Each provider decides how many tokens to batch per frame. It says nothing about speed.
6. **Why can a hosting platform or proxy break streaming?** Some buffer or compress whole responses before sending them on. The `no-transform` and `x-accel-buffering: no` headers ask them not to.
7. **What does `after()` do, and why save the run after the response?** It runs work once the response has finished, so the database round trip never delays your answer.

## 4. Embeddings

1. **Can I switch embedding models later, or mix two?** Not without re-embedding everything. Vectors from different models live in different spaces, which is why the app keeps one column per model.
2. **How many dimensions should I use?** Fewer dimensions mean smaller storage and faster search, at some loss of accuracy. With Matryoshka models, measure 256 against 768 on your own evals.
3. **What happens if a chunk is longer than the model's input limit?** The extra text is cut off or rejected (Gemini: 2,048 tokens; the local model: 256). That's another reason chunks stay small.
4. **Why do unrelated sentences still score 0.7?** Every model has its own floor. Only compare scores from the same model, and trust the ranking more than the number.
5. **Should I drop chunks below a similarity cutoff?** Only with a cutoff you've measured for that model. Otherwise rely on top-k plus a reranker.
6. **Do embeddings work across languages?** Multilingual models (Gemini) do. English-only ones (MiniLM) don't, as the playground's Spanish and Hindi rows show.
7. **When would I use the local model instead of Gemini?** When it must be free, offline or private, or when you need lots of embeddings (semantic chunking). Expect lower quality.
8. **Are images, tables and PDF layout embedded too?** Not here. Only extracted text is embedded, so tables arrive as flattened text.

## 5. Chunking

1. **Is 400 tokens the same as 400 words?** No, about 300 words of English.
2. **Is the document's title or heading part of each chunk's vector?** No. The app embeds only the chunk text, and the title is added just in the prompt label. Prefixing a heading ("contextual chunks") is a known improvement. **(check)** in `lib/ingest`.
3. **How should I chunk tables, code and Markdown?** Split on their structure: rows and headers, functions, headings. Keep a table's header with its rows. The app's recursive splitter only knows text separators.
4. **What happens to existing chunks when I try a new strategy?** The lab saves a new, inactive chunk set. Chat keeps using the active one until you switch.
5. **Does more overlap always help?** No. It adds storage and embedding cost in proportion, and the benefit flattens quickly past 10–20%.
6. **What is "small-to-big" (parent document) retrieval?** You search small chunks but send the larger section around them to the model. The app doesn't do it, but it's a common next step.
7. **Do scanned PDFs or two-column PDFs work?** Scanned PDFs don't: there's no OCR, and the upload says so. Columns can come out interleaved, so check the extracted text in the chunking lab.
8. **Why does semantic chunking run on the local model?** It needs one embedding per sentence (416 for the build plan), which would eat Gemini's daily quota.

## 6. Vector databases

1. **When does Postgres actually start using the HNSW index?** When the planner estimates that the index beats a full scan, usually somewhere in the thousands of rows. Check with `EXPLAIN ANALYZE`.
2. **Can I filter by document or metadata during vector search?** Yes, with a `WHERE` clause. But a strict filter on an approximate index can return fewer than k results. **(check)** pgvector's iterative index scans and the version Neon runs.
3. **How many vectors can pgvector handle?** Millions with HNSW, if the index fits in memory. Past that, or with heavy filtering, dedicated databases start to earn their place.
4. **What does an HNSW index cost?** Memory, and slower inserts and builds. Tuning `m` and `ef_construction` trades build cost for recall.
5. **Why cosine distance and not inner product?** For unit-length vectors they rank the same. Cosine is the safe default when you're not sure vectors are normalised.
6. **What happens to vectors when I delete a document?** Its chunk sets and chunks, vectors included, are deleted with it (`ON DELETE CASCADE`).

## 7. Keyword search and hybrid retrieval

1. **Does keyword search handle synonyms or typos?** No. Stemming joins "replaced" and "replace", but "automobile" never matches "car", and a typo matches nothing. `pg_trgm` can help with typos.
2. **Why is k = 60, and should I tune it?** It comes from the original RRF paper and works well across corpora. Tune it only if your evals show a difference.
3. **Can I trust one list more than the other?** Yes, with weighted RRF (a weight per list). The app uses equal weights.
4. **Does keyword search work for other languages?** Only with that language's text-search config. The app uses `'english'`, so Hindi text gets no stemming or stop words.
5. **Does hybrid make search slower?** Barely. The two queries run in parallel, and merging the lists is in-memory maths.
6. **Why are RRF scores so tiny (0.03)?** They're sums of 1/(60 + rank), and only their order matters. They aren't comparable with cosine scores.
7. **When is hybrid not worth it?** When questions are natural language with no identifiers and your evals show no gain. The cost is one extra cheap query.

## 8. Reranking

1. **Can an LLM do the reranking instead of Cohere?** Yes: ask it to score or order the candidates. It's slower and pricier per query, and its scores are less consistent.
2. **Are there free or local rerankers?** Yes, open cross-encoders (such as the BGE and MS MARCO rerankers) can run locally. The app uses Cohere's trial instead.
3. **Can I drop candidates below a rerank score?** Rerank scores are spread out more than cosine scores, so a cutoff is more reasonable here. Still measure it, because scores vary by query.
4. **Why is rerank off by default in chat?** The trial key allows 1,000 calls a month and 10 a minute, so the arena gets it by default and chat asks you to opt in.
5. **What happens if Cohere fails or the quota runs out?** In the arena, the rerank column shows the error and the other columns still work. In chat, the request fails. **(check)** whether chat should fall back to hybrid's order.
6. **Why does one rerank bill around 7,000 tokens?** Cohere reads the question plus all 20 candidates' full text.
7. **Does reranking change which chunks the model sees, or only their order?** Both. It reorders 20 candidates and keeps the top 5, so chunks can enter or leave the prompt.

## 9. Prompt construction

1. **Why does the model sometimes cite a source that doesn't support the claim?** Citing is generation too. The model can attach the wrong number. Faithfulness evals (Lesson 10) catch this, and the app only checks that cited numbers exist.
2. **What if the model answers from its own knowledge anyway?** Tighten the rules, lower the temperature, and test with off-topic questions. No prompt makes it impossible.
3. **How does a follow-up like "what about its price?" work?** Retrieval uses only the latest question, so a vague follow-up can retrieve the wrong chunks. Query rewriting with the history fixes that. The app doesn't do it.
4. **Can a document "attack" the prompt (prompt injection)?** Yes. Text inside a source can contain instructions. Sources are marked as data, but no prompt fully prevents it, so never give a RAG model powers it doesn't need.
5. **Should the sources come before or after the question?** The app puts them before the question, in the same message. Long-context guidance generally suggests context first and question last.
6. **Why number sources [1] instead of using document names?** Numbers are short to generate, unambiguous, and easy to parse and check.
7. **How many sources should I send?** As few as still answer well. Measure top 3 against top 5 against top 10, and watch both cost and faithfulness.

## 10. Evaluating RAG

1. **How many eval questions do I need?** Enough to cover your question types and known failure cases. 25 is a start, and 50–200 makes changes measurable above the noise.
2. **Can an LLM write my eval questions?** It can draft them from your documents. Check every one by hand, because generated questions tend to copy the source's wording, which flatters keyword and vector search.
3. **Hit rate, MRR or nDCG: which should I watch?** Hit rate for "was it found", MRR for "how high". nDCG matters when several chunks are relevant at different levels.
4. **Why a 60% trigram overlap for a hit?** It survives formatting and boundary cuts without crediting chunks that only share a few words. It's a judgement call, tested on this set.
5. **Can a model judge its own answers?** It can, but it tends to favour itself. A stronger, different judge is safer, spot-checked by you.
6. **Faithfulness is 5/5 everywhere. Is the app perfect?** More likely the judge is lenient. Add harder questions, or a stricter rubric, until the metric moves.
7. **How do I evaluate in production, where there are no known answers?** Sample real questions for judge scoring, track citation checks, and collect user feedback. Then turn failures into new eval items.

## 11. Caching and cost

1. **Can I cache whole answers?** Yes, for an identical question with the same sources and model, but answers go stale when documents change. The app caches embeddings and reranks, not answers.
2. **Can a cache ever serve something stale?** Not here. Every key includes the model, dimensions, task type and a hash of the exact text (and, for rerank, the candidate ids), so any change is a new key.
3. **How do I estimate the monthly cost for N users?** Average cost per question from the ledger × questions per user × users. The what-if panel shows how top-k and chunk size move it.
4. **What's the difference between implicit and explicit prompt caching?** Implicit is automatic and best-effort (what Gemini did here). Explicit means you create a cache and pay to keep it, which is useful for a big fixed document.
5. **What happens when I hit a daily free quota?** Calls fail with a long `retry-after`. The app gives up fast instead of waiting. Gemini's quotas reset at midnight Pacific.
6. **Why add jitter to backoff?** So many clients that failed together don't all retry at the same instant and fail together again.
7. **Is Upstash itself free, and does it have limits?** It has a free tier with request and storage limits. **(check)** current numbers before quoting them.

## 12. Libraries vs hand-rolled

1. **Should I learn LangChain or LlamaIndex too?** They bundle much more (loaders, retrievers, agents) and hide more. Worth knowing, and easier once you've built the pieces by hand. The corpus has a note on them.
2. **Does the AI SDK work with OpenAI, Anthropic and others?** Yes, through one provider package each, with the same `streamText()` call.
3. **Can I use the SDK only for model calls and keep my own retrieval?** Yes. That's exactly what the app's SDK route does.
4. **How do I get usage for a stopped stream with the SDK?** It isn't reported. You'd estimate it from the streamed text, or read the provider's raw chunks.
5. **What does the SDK give me that the hand-rolled version doesn't have?** Tool calling, structured output, multi-step agent loops, and many providers behind one API.
6. **Does the library make responses slower?** Not measurably. Provider latency swings by seconds and buries any overhead.

## 13. The full pipeline

1. **Why does embedding an 18-token question take 869 ms?** Almost all of it is the network round trip and the API's own overhead, not the maths. The cached run took 49 ms.
2. **Could the stages run in parallel?** Mostly not: each needs the previous one's output. The two searches already run in parallel.
3. **Why does the model take about 0.8 s to start, even when everything before it is cached?** It has to read all 1,910 input tokens and queue on the provider before the first token. Caching our own calls can't touch that.
4. **What would change with a million chunks?** The HNSW index would kick in and search would become real database work. Rerank and the model would cost the same, since they still see 20 and 5 chunks.
5. **What's the single biggest speed-up for this app?** Put the server near the database and cache what repeats. Then decide whether rerank's second is worth it for your questions.
6. **What happens if saving the run fails?** The answer has already reached you. Only the record (inspectors, ledger) is missing. **(check)** how `after()` failures are logged.
7. **How do I measure stage timings in my own app?** Time each step on the server and send the timings to the client, as events (like the app's `retrieval` event) or `Server-Timing` headers.

## Questions for Jd

- **Placement:** at the end of each lesson, after Interview angle and before Go deeper?
- **Format:** a collapsible list (one `<details>` per question), so the lesson doesn't get much longer?
