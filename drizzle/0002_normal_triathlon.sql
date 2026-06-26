ALTER TABLE "qa_pairs" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "qa_pairs" ADD COLUMN "canonical_id" uuid;--> statement-breakpoint
ALTER TABLE "qa_pairs" ADD COLUMN "meta_title" text;--> statement-breakpoint
ALTER TABLE "qa_pairs" ADD COLUMN "meta_description" text;--> statement-breakpoint
ALTER TABLE "qa_pairs" ADD COLUMN "featured_image_url" text;--> statement-breakpoint
ALTER TABLE "qa_pairs" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "qa_pairs" ADD COLUMN "ai_score" integer;--> statement-breakpoint
ALTER TABLE "qa_pairs" ADD COLUMN "ai_score_reasons" jsonb;--> statement-breakpoint
CREATE INDEX "idx_qa_status" ON "qa_pairs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_qa_published" ON "qa_pairs" USING btree ("published_at");