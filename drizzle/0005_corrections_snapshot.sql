ALTER TABLE "corrections" ADD COLUMN "question" text;--> statement-breakpoint
ALTER TABLE "corrections" ADD COLUMN "answer" text;--> statement-breakpoint
ALTER TABLE "corrections" ADD COLUMN "domain" text;--> statement-breakpoint
ALTER TABLE "corrections" ADD COLUMN "skill_versions" jsonb;--> statement-breakpoint
ALTER TABLE "corrections" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "corrections" ADD COLUMN "target_skill" text;