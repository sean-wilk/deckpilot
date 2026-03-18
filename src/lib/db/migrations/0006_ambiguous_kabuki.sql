ALTER TABLE "admin_ai_config" ADD COLUMN "max_tokens_analysis" integer DEFAULT 8192 NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_ai_config" ADD COLUMN "max_tokens_recommendations" integer DEFAULT 8192 NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_ai_config" ADD COLUMN "max_tokens_chat" integer DEFAULT 4096 NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_ai_config" ADD COLUMN "max_tokens_generation" integer DEFAULT 16384 NOT NULL;