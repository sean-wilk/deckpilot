CREATE TABLE "deck_card_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_card_id" uuid NOT NULL,
	"category" text NOT NULL,
	"is_manual_override" boolean DEFAULT false NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deck_card_categories_deck_card_id_category_unique" UNIQUE("deck_card_id","category")
);
--> statement-breakpoint
CREATE TABLE "deck_structure_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"deck_version_id" uuid,
	"results" jsonb,
	"strategy_model" text,
	"assignment_model" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"cost_cents" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_ai_config" ADD COLUMN "model_structure_strategy" text;--> statement-breakpoint
ALTER TABLE "admin_ai_config" ADD COLUMN "model_structure_assignment" text;--> statement-breakpoint
ALTER TABLE "admin_ai_config" ADD COLUMN "max_tokens_structure_strategy" integer DEFAULT 4096;--> statement-breakpoint
ALTER TABLE "admin_ai_config" ADD COLUMN "max_tokens_structure_assignment" integer DEFAULT 8192;--> statement-breakpoint
ALTER TABLE "decks" ADD COLUMN "custom_categories" jsonb;--> statement-breakpoint
ALTER TABLE "deck_card_categories" ADD CONSTRAINT "deck_card_categories_deck_card_id_deck_cards_id_fk" FOREIGN KEY ("deck_card_id") REFERENCES "public"."deck_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_structure_analyses" ADD CONSTRAINT "deck_structure_analyses_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_structure_analyses" ADD CONSTRAINT "deck_structure_analyses_deck_version_id_deck_versions_id_fk" FOREIGN KEY ("deck_version_id") REFERENCES "public"."deck_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_deck_structure_analyses_deck_id" ON "deck_structure_analyses" USING btree ("deck_id");