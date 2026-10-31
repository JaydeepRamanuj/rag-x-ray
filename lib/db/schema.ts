import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

import { embeddingModels } from "@/lib/config";

// Drizzle has no built-in tsvector type. We only ever read it through raw SQL
// (ts_rank, @@), so a plain string mapping is enough.
const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
});

export const documents = pgTable("documents", {
  id: uuid().primaryKey().defaultRandom(),
  title: text().notNull(),
  sourceType: text("source_type").notNull(), // 'pdf' | 'md' | 'txt'
  rawText: text("raw_text").notNull(),
  tokenCount: integer("token_count").notNull(),
  // sha256 of the extracted text. Re-uploading the same content replaces the
  // old copy instead of duplicating every chunk in search results.
  contentHash: text("content_hash").unique(),
  pageCount: integer("page_count"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// One row per chunking experiment on a document, so strategies can coexist
// and be compared on the same text.
export const chunkSets = pgTable("chunk_sets", {
  id: uuid().primaryKey().defaultRandom(),
  documentId: uuid("document_id").references(() => documents.id, {
    onDelete: "cascade",
  }),
  strategy: text().notNull(), // 'fixed' | 'recursive' | 'sentence' | 'semantic'
  chunkSize: integer("chunk_size"), // in tokens
  overlap: integer(),
  // Semantic only: the neighbour similarity below which it cuts.
  threshold: real(),
  isActive: boolean("is_active").default(false), // the set chat uses
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const chunks = pgTable(
  "chunks",
  {
    id: uuid().primaryKey().defaultRandom(),
    chunkSetId: uuid("chunk_set_id").references(() => chunkSets.id, {
      onDelete: "cascade",
    }),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "cascade",
    }),
    ordinal: integer().notNull(),
    content: text().notNull(),
    tokenCount: integer("token_count").notNull(),
    // Character offsets let the UI highlight the chunk inside the source.
    startChar: integer("start_char"),
    endChar: integer("end_char"),
    // One column per embedding model: vectors from different models live in
    // different spaces and can never be compared, so they must not share one.
    embedding: vector({ dimensions: embeddingModels.gemini.dimensions }),
    embeddingLocal: vector("embedding_local", {
      dimensions: embeddingModels.local.dimensions,
    }),
    // Postgres keeps this in sync with content on every write.
    tsv: tsvector().generatedAlwaysAs(sql`to_tsvector('english', content)`),
  },
  (t) => [
    // HNSW = approximate nearest-neighbour graph; cosine ops match how
    // embedding models are trained to be compared.
    index("chunks_embedding_hnsw").using("hnsw", t.embedding.op("vector_cosine_ops")),
    index("chunks_embedding_local_hnsw").using("hnsw", t.embeddingLocal.op("vector_cosine_ops")),
    index("chunks_tsv_gin").using("gin", t.tsv),
    index("chunks_chunk_set_id_idx").on(t.chunkSetId),
  ],
);

// Every chat request, fully recorded for the inspectors and the ledger.
export const runs = pgTable("runs", {
  id: uuid().primaryKey().defaultRandom(),
  question: text().notNull(),
  config: jsonb().notNull(), // provider, model, top_k, method, rerank, temperature...
  finalPrompt: jsonb("final_prompt").notNull(), // exact messages sent
  answer: text(),
  // 'ok' | 'stopped' | 'error'. A stopped run keeps its partial answer, so
  // you can see what the tokens you paid for actually bought.
  status: text().notNull().default("ok"),
  error: text(),
  embedTokens: integer("embed_tokens"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  cachedTokens: integer("cached_tokens"),
  // Thinking tokens, a subset of output_tokens. Billed as output but never
  // shown, so the ledger splits them out to show what reasoning costs.
  reasoningTokens: integer("reasoning_tokens"),
  ttftMs: integer("ttft_ms"),
  totalMs: integer("total_ms"),
  // numeric, not float: money should not pick up binary rounding errors.
  estCostUsd: numeric("est_cost_usd", { precision: 10, scale: 6 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const runChunks = pgTable(
  "run_chunks",
  {
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    chunkId: uuid("chunk_id")
      .notNull()
      .references(() => chunks.id, { onDelete: "cascade" }),
    method: text().notNull(), // 'vector' | 'keyword' | 'hybrid' | 'rerank'
    rank: integer(),
    score: real(),
    usedInPrompt: boolean("used_in_prompt"),
  },
  // A chunk can appear once per retrieval method in the same run.
  (t) => [primaryKey({ columns: [t.runId, t.chunkId, t.method] })],
);

// One row per upload that reached the embedding step. Queries are counted in
// runs.embed_tokens; this covers ingestion, so the ledger's daily chart sees
// every embedding call, not just the ones made while chatting.
export const ingestUsage = pgTable("ingest_usage", {
  id: uuid().primaryKey().defaultRandom(),
  // Kept when the document is deleted: the quota was used either way.
  documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
  title: text().notNull(),
  status: text().notNull(), // 'ok' | 'error'
  chunks: integer().notNull(),
  cacheHits: integer("cache_hits").notNull(),
  // Local estimate: the embeddings API reports no usage.
  embedTokens: integer("embed_tokens").notNull(),
  // batchEmbedContents calls made, i.e. requests against the daily quota.
  requests: integer().notNull(),
  totalMs: integer("total_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const evalItems = pgTable("eval_items", {
  id: uuid().primaryKey().defaultRandom(),
  /** Display order; items are imported as a batch, so created_at can't order them. */
  ordinal: integer().notNull().default(0),
  question: text().notNull(),
  expectedAnswer: text("expected_answer").notNull(),
  // The passage holding the answer, stored as text rather than a chunk id so
  // the item survives re-chunking.
  sourceText: text("source_text").notNull(),
});

export const evalRuns = pgTable("eval_runs", {
  id: uuid().primaryKey().defaultRandom(),
  config: jsonb().notNull(),
  // { items: per-item retrieval, answer and judgement; judgeCalls: one per batch }
  results: jsonb().notNull(),
  // The browser drives a run one step at a time, so a run can be left
  // half done: "running" until finished, then "done" or "error".
  status: text().notNull().default("running"),
  error: text(),
  hitRate: real("hit_rate"),
  mrr: real(),
  faithfulness: real(),
  answerRelevance: real("answer_relevance"),
  totalTokens: integer("total_tokens"),
  /** What the answer and judge calls would cost on the paid tier. */
  costUsd: real("cost_usd"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});
