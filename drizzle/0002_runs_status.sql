ALTER TABLE "runs" ADD COLUMN "status" text DEFAULT 'ok' NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "error" text;