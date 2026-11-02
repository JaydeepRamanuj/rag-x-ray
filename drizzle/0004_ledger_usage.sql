CREATE TABLE "ingest_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"chunks" integer NOT NULL,
	"cache_hits" integer NOT NULL,
	"embed_tokens" integer NOT NULL,
	"requests" integer NOT NULL,
	"total_ms" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "reasoning_tokens" integer;--> statement-breakpoint
ALTER TABLE "ingest_usage" ADD CONSTRAINT "ingest_usage_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;