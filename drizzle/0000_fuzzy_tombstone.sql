CREATE TABLE "qa_pairs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" text NOT NULL,
	"question_normalized" text NOT NULL,
	"answer_markdown" text NOT NULL,
	"source_refs" text[] NOT NULL,
	"topics" text[],
	"categories" text[],
	"language" text DEFAULT 'en',
	"view_count" integer DEFAULT 0,
	"slug" text,
	"similarity" real,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "qa_pairs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX "idx_qa_slug" ON "qa_pairs" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_qa_created" ON "qa_pairs" USING btree ("created_at");