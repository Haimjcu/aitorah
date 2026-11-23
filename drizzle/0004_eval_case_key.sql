ALTER TABLE "eval_cases" ADD COLUMN "key" text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_eval_cases_key" ON "eval_cases" USING btree ("key");