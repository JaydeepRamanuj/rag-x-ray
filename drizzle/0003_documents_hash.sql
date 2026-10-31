ALTER TABLE "documents" ADD COLUMN "content_hash" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "page_count" integer;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_content_hash_unique" UNIQUE("content_hash");