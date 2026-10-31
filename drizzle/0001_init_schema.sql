CREATE TABLE "chunk_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid,
	"strategy" text NOT NULL,
	"chunk_size" integer,
	"overlap" integer,
	"is_active" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chunk_set_id" uuid,
	"document_id" uuid,
	"ordinal" integer NOT NULL,
	"content" text NOT NULL,
	"token_count" integer NOT NULL,
	"start_char" integer,
	"end_char" integer,
	"embedding" vector(768),
	"embedding_local" vector(384),
	"tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"source_type" text NOT NULL,
	"raw_text" text NOT NULL,
	"token_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "eval_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" text NOT NULL,
	"expected_answer" text NOT NULL,
	"source_text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eval_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config" jsonb NOT NULL,
	"results" jsonb NOT NULL,
	"hit_rate" real,
	"mrr" real,
	"faithfulness" real,
	"answer_relevance" real,
	"total_tokens" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "run_chunks" (
	"run_id" uuid NOT NULL,
	"chunk_id" uuid NOT NULL,
	"method" text NOT NULL,
	"rank" integer,
	"score" real,
	"used_in_prompt" boolean,
	CONSTRAINT "run_chunks_run_id_chunk_id_method_pk" PRIMARY KEY("run_id","chunk_id","method")
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" text NOT NULL,
	"config" jsonb NOT NULL,
	"final_prompt" jsonb NOT NULL,
	"answer" text,
	"embed_tokens" integer,
	"input_tokens" integer,
	"output_tokens" integer,
	"cached_tokens" integer,
	"ttft_ms" integer,
	"total_ms" integer,
	"est_cost_usd" numeric(10, 6),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "chunk_sets" ADD CONSTRAINT "chunk_sets_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_chunk_set_id_chunk_sets_id_fk" FOREIGN KEY ("chunk_set_id") REFERENCES "public"."chunk_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_chunks" ADD CONSTRAINT "run_chunks_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_chunks" ADD CONSTRAINT "run_chunks_chunk_id_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."chunks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chunks_embedding_hnsw" ON "chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "chunks_embedding_local_hnsw" ON "chunks" USING hnsw ("embedding_local" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "chunks_tsv_gin" ON "chunks" USING gin ("tsv");--> statement-breakpoint
CREATE INDEX "chunks_chunk_set_id_idx" ON "chunks" USING btree ("chunk_set_id");