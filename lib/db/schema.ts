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

export const evalItems = pgTable("eval_items", {
  id: uuid().primaryKey().defaultRandom(),
  question: text().notNull(),
  expectedAnswer: text("expected_answer").notNull(),
  // The passage holding the answer, stored as text rather than a chunk id so
  // the item survives re-chunking.
  sourceText: text("source_text").notNull(),
});

export const evalRuns = pgTable("eval_runs", {
  id: uuid().primaryKey().defaultRandom(),
  config: jsonb().notNull(),
  results: jsonb().notNull(), // per item: retrieved ids, hit, faithfulness, judge reason
  hitRate: real("hit_rate"),
  mrr: real(),
  faithfulness: real(),
  answerRelevance: real("answer_relevance"),
  totalTokens: integer("total_tokens"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
