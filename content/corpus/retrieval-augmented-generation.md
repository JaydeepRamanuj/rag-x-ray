# Retrieval-Augmented Generation (RAG): How It Works, Stage by Stage

**Retrieval-augmented generation (RAG)** answers a question in two steps: first **retrieve** the passages most likely to contain the answer from your own documents, then **generate** an answer with an LLM that is told to use those passages. The model's weights supply language skill; the retrieved text supplies the facts.

The term comes from the 2020 paper "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks" by Patrick Lewis and colleagues at Facebook AI Research (now Meta AI). Their version trained a retriever and a generator together. The RAG most applications build today is simpler: an off-the-shelf embedding model, a vector index and a prompt to a chat model, with no training at all.

## Why RAG exists

RAG solves four problems that a bare LLM has:

1. **Knowledge cutoff.** The model knows nothing after its training data was collected.
2. **Private data.** It has never seen your documents, tickets or code.
3. **Hallucination.** It produces plausible text even when it does not know. Grounding the answer in retrieved text, and asking for citations, makes errors less likely and easier to check.
4. **Updating knowledge.** Changing what a model knows by fine-tuning is slow, costly and unreliable for facts. With RAG you update a document and the next answer uses it.

**RAG versus fine-tuning:** fine-tuning changes how a model behaves (style, format, a narrow skill); RAG changes what it knows at question time. They combine well, but for "answer questions about our documents", RAG is almost always the first tool to reach for.

**RAG versus long context:** with context windows of a million tokens, you could paste every document into every prompt. For a small, fixed set of documents that can work. It stops working when the library is larger than the window, when cost and latency matter (you pay for every input token on every question), and when the answer sits in the middle of a long prompt, where models attend least ("Lost in the Middle", Liu et al., 2023).

## The two pipelines

A RAG system has an **ingestion pipeline** that runs once per document and a **query pipeline** that runs on every question.

**Ingestion:** load → extract text → split into chunks → embed each chunk → store chunks and vectors in an index.

**Query:** take the question → (optionally rewrite it) → embed it → search the index → (optionally rerank) → build a prompt with the top chunks → generate an answer → (optionally) cite sources.

## Ingestion, stage by stage

### Loading and extraction

Documents arrive as PDFs, HTML, Markdown, Word files, slides, or database rows. Extraction quality limits everything after it. PDFs are the hardest: text may come out in the wrong reading order across columns, tables lose their structure, headers and footers repeat on every page, and scanned PDFs contain no text at all and need **OCR** (optical character recognition). Keeping metadata such as the source file, page number and section heading pays off later for filtering and citations.

### Chunking

Embedding models and prompts work best on passages, not whole documents, so text is split into **chunks**. Chunk size is a trade-off:

- **Too large:** one vector has to represent many topics, so similarity to any single question is diluted, and each retrieved chunk costs more prompt tokens.
- **Too small:** a chunk loses the context needed to understand it (a sentence saying "it was 40" without saying what "it" is).

Common strategies:

| Strategy            | How it splits                                                                                   | Strength                                    | Weakness                                                |
| ------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------- |
| **Fixed-size**      | Every N tokens, often with overlap                                                              | Simple, predictable sizes                   | Cuts mid-sentence and mid-idea                          |
| **Recursive**       | Tries paragraph breaks first, then lines, then sentences, then words, until pieces fit the size | Respects document structure; a good default | Still unaware of meaning                                |
| **Sentence-based**  | Groups whole sentences up to a size                                                             | Never cuts a sentence                       | Uneven sizes; sentence detection fails on abbreviations |
| **Semantic**        | Embeds sentences and cuts where similarity between neighbours drops                             | Chunks follow topic changes                 | Costs an embedding pass; sensitive to its threshold     |
| **Structure-aware** | Splits on headings, functions, or table rows                                                    | Matches how the document is organized       | Needs a parser per format                               |

**Overlap** repeats a few tokens (often 10–15% of the chunk size) from the end of one chunk at the start of the next, so a fact that straddles a boundary survives in at least one chunk. Typical starting points are 200 to 500 tokens per chunk with 10–20% overlap. The best size depends on the documents and the questions, which is why it should be measured with an eval set rather than guessed.

Variants that add context to chunks:

- **Parent–child (small-to-big) retrieval:** search over small chunks for precision, but send the larger parent section to the model for context.
- **Contextual retrieval:** before embedding, prepend a short LLM-written summary of where the chunk sits in the document ("This chunk is from the Q3 report's section on churn..."). Anthropic described this in 2024 and reported large drops in retrieval failures, at the cost of one LLM call per chunk at ingestion.

### Embedding

An **embedding model** turns a chunk into a vector, typically 384 to 3,072 numbers, such that texts with similar meaning get vectors pointing in similar directions. Embedding models are usually Transformer encoders trained with **contrastive learning**: pull together the vectors of a question and its correct passage, push apart unrelated pairs.

Things that matter in practice:

- **Use the same model for documents and queries.** Vectors from different models live in different spaces and cannot be compared. Changing the embedding model means re-embedding everything.
- **Asymmetric search.** Questions are short and passages are long. Many models take a task type or a prefix (for example `RETRIEVAL_QUERY` versus `RETRIEVAL_DOCUMENT` in Gemini's embedding API, or "query: " and "passage: " prefixes in the E5 family) so each side is embedded appropriately.
- **Dimensions.** More dimensions can hold more nuance but cost more storage and search time. Models trained with **Matryoshka representation learning** let you keep only the first 256 or 768 numbers of a longer vector with a small loss of quality.
- **Input limits.** Embedding models silently truncate input past their maximum length (for example 512 tokens for many small models), so an oversized chunk is embedded only by its beginning.
- **Local versus hosted.** Small open models such as all-MiniLM-L6-v2 (384 dimensions) run on a CPU for free; hosted models such as Gemini's or OpenAI's are usually more accurate and multilingual. The **MTEB** leaderboard compares embedding models across many tasks.

### Indexing and the vector database

Vectors are stored in a **vector index** so that the nearest ones to a query can be found quickly. Similarity is usually **cosine similarity** (the angle between vectors), the **dot product**, or **Euclidean distance**. For unit-length vectors, cosine similarity and dot product give the same ranking.

Exact search compares the query with every stored vector. That is fine for thousands of chunks but too slow for many millions, so large systems use **approximate nearest neighbour (ANN)** indexes:

- **HNSW** (hierarchical navigable small world) builds a layered graph in which each vector links to its near neighbours; search walks the graph greedily from a coarse top layer down. It has high recall and fast queries but uses more memory.
- **IVF** (inverted file) clusters vectors and searches only the clusters nearest the query. It builds faster and uses less memory, with lower recall at the same speed.

Options range from libraries (FAISS) to dedicated databases (Pinecone, Weaviate, Qdrant, Milvus, Chroma) to extensions of existing databases, such as **pgvector** for Postgres, which keeps vectors in the same tables and transactions as the rest of the data.

## Query, stage by stage

### Query transformation (optional)

The user's question is not always a good search query.

- **Query rewriting / condensing:** in a conversation, "what about its price?" means nothing alone. An LLM rewrites it into a standalone question using the chat history.
- **Multi-query:** generate several phrasings of the question, search with each, and merge the results.
- **HyDE (hypothetical document embeddings, 2022):** ask the LLM to write a fake answer, then embed that answer instead of the question, because a fake answer looks more like the real passage than the question does.
- **Decomposition:** split a multi-part question into sub-questions and retrieve for each.

### Retrieval methods

**Dense (vector) retrieval** embeds the question and finds the nearest chunks. It matches meaning and paraphrases ("car" finds "automobile") but can miss exact terms such as error codes, product names, IDs and rare words, which an embedding may blur together.

**Sparse (keyword) retrieval** scores chunks by the words they share with the query. The classic scoring function is **BM25**, which rewards terms that are frequent in the chunk but rare across the collection (an IDF weighting), with diminishing returns for repeats and a penalty for long documents. Postgres full-text search, with `tsvector`, `tsquery` and `ts_rank_cd`, offers a similar keyword ranking. Keyword search excels at exact identifiers but fails on synonyms and paraphrases.

**Hybrid retrieval** runs both and merges the lists. Scores from the two methods are on different scales (a cosine similarity and a BM25 score cannot be added), so the usual merge is **reciprocal rank fusion (RRF)** (Cormack, Clarke and Büttcher, 2009): each chunk's fused score is the sum over lists of `1 / (k + rank)`, with k typically 60. RRF uses only ranks, so it needs no score calibration, and a chunk that ranks well in both lists rises to the top.

### Reranking

First-stage retrieval uses a **bi-encoder**: question and chunk are embedded separately, so chunk vectors can be computed in advance. That is fast but coarse, because the two texts never "see" each other.

A **reranker** is a **cross-encoder**: it reads the question and one chunk together in a single Transformer pass and outputs a relevance score. This is much more accurate but too slow to run over the whole library, so it is applied only to the top 20 to 100 candidates from the first stage. The pattern "retrieve wide with a cheap method, rerank narrow with an expensive one" is called **two-stage retrieval**. Hosted rerankers include Cohere Rerank and Voyage; open ones include the BGE rerankers. **ColBERT** (2020) sits in between: it stores a vector per token and scores with "late interaction", nearly as accurate as a cross-encoder at a fraction of the cost.

### Prompt construction

The selected chunks are placed in the prompt along with instructions. A typical RAG prompt says: answer only from the sources below; cite sources by number; if the sources do not contain the answer, say so. Practical rules:

- Put the most relevant chunks at the start or end, not buried in the middle.
- Label each chunk with an ID and source so the model can cite it.
- Budget tokens: the system prompt, chunks, conversation history and the expected answer all share the context window and the bill.
- **top-k**, the number of chunks sent, trades recall (more chances to include the answer) against noise and cost. Five is a common default.

### Generation and citations

The LLM writes the answer, ideally with citations such as [1] and [3] pointing to the chunks it used. Citations let the user verify claims and let the system check **faithfulness** automatically.

## How RAG fails

Most RAG failures are retrieval failures, not generation failures. A useful checklist:

1. **The answer is not in the documents.** No method can retrieve it; the model should say it does not know.
2. **Extraction lost it.** A table flattened into nonsense, or a scanned page with no text.
3. **Chunking split it.** Half the fact is in one chunk and half in the next.
4. **Retrieval missed it.** The right chunk exists but ranked 12th with top-k of 5. Keyword-heavy questions often fail with vector-only search; paraphrased questions often fail with keyword-only search.
5. **Too much noise.** The right chunk was retrieved but surrounded by distracting ones, and the model used the wrong one.
6. **The model ignored the sources** and answered from its own weights (an unfaithful answer).
7. **The question needed reasoning across many chunks**, such as "compare all the quarterly reports", which top-k similarity search is not designed for.

## Evaluating RAG

You cannot improve what you do not measure. RAG evaluation separates the two halves.

**Retrieval metrics** need an eval set of questions, each paired with the passage that answers it:

- **Hit rate@k (recall@k):** the share of questions where a correct chunk appears in the top k results.
- **MRR (mean reciprocal rank):** for each question take 1 divided by the rank of the first correct chunk (1 if first, 0.5 if second, 0.33 if third, 0 if absent), then average. MRR rewards putting the answer at the top, not just somewhere in the list.
- **nDCG** (normalized discounted cumulative gain) generalizes MRR to several relevant chunks with graded relevance.

**Generation metrics** are usually scored by a stronger LLM acting as a judge (**LLM-as-a-judge**):

- **Faithfulness (groundedness):** is every claim in the answer supported by the retrieved chunks? An unfaithful answer may still be true, but it did not come from the sources.
- **Answer relevance:** does the answer actually address the question asked?
- **Context precision and context recall:** how much of the retrieved context was useful, and did it contain everything needed.
- **Correctness:** does the answer agree with a reference answer written by a person.

Frameworks such as **RAGAS**, TruLens and DeepEval package these metrics. LLM judges have known biases (they favour longer answers, answers in their own style, and the first of two options shown), so a judge prompt should ask for reasoning before the score, use a small fixed scale, and be spot-checked against human judgement.

A good eval loop changes **one setting at a time**, such as chunk size, retrieval method, top-k or reranking, and compares runs on the same question set.

## Beyond basic RAG

- **Agentic RAG:** the model decides whether to search, what to search for and whether the results are good enough, calling retrieval as a tool in a loop rather than once.
- **GraphRAG** (Microsoft Research, 2024): an LLM extracts entities and relationships into a knowledge graph and writes summaries of communities of related entities, which helps with global questions such as "what are the main themes across these documents?" that top-k chunk search handles poorly.
- **Corrective RAG (CRAG)** and **Self-RAG** (both 2023–2024): the system grades its own retrieved documents or draft answer and retries, rewrites the query or falls back to web search when quality is low.
- **Multimodal RAG:** retrieving images, tables and page screenshots alongside text, using multimodal embedding models.

## Summary

RAG is a search engine glued to a language model. Ingestion prepares text so the right passage can be found: extract, chunk, embed, index. The query pipeline finds it and hands it to the model: transform, retrieve (vector, keyword or hybrid), rerank, build the prompt, generate with citations. Most quality problems come from retrieval, so measure it with hit rate and MRR, measure answers with faithfulness and relevance, and change one thing at a time.
