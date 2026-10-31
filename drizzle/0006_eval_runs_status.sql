ALTER TABLE "eval_items" ADD COLUMN "ordinal" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD COLUMN "status" text DEFAULT 'running' NOT NULL;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD COLUMN "error" text;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD COLUMN "cost_usd" real;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD COLUMN "finished_at" timestamp with time zone;