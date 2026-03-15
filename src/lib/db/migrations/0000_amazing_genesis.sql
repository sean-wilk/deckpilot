CREATE TABLE "admin_ai_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"model_analysis" text NOT NULL,
	"model_recommendations" text NOT NULL,
	"model_chat" text NOT NULL,
	"model_generation" text NOT NULL,
	"api_key_encrypted" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"usage_limit_daily_cents" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scryfall_id" text,
	"oracle_id" text,
	"name" text NOT NULL,
	"mana_cost" text,
	"cmc" numeric NOT NULL,
	"type_line" text NOT NULL,
	"oracle_text" text,
	"colors" text[] NOT NULL,
	"color_identity" text[] NOT NULL,
	"power" text,
	"toughness" text,
	"keywords" text[] NOT NULL,
	"legalities" jsonb NOT NULL,
	"rarity" text NOT NULL,
	"set_code" text NOT NULL,
	"image_uris" jsonb,
	"card_faces" jsonb,
	"prices" jsonb NOT NULL,
	"edhrec_rank" integer,
	"synced_at" timestamp with time zone NOT NULL,
	CONSTRAINT "cards_scryfall_id_unique" UNIQUE("scryfall_id"),
	CONSTRAINT "cards_oracle_id_unique" UNIQUE("oracle_id")
);
--> statement-breakpoint
CREATE TABLE "deck_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"deck_version_id" uuid,
	"analysis_type" text NOT NULL,
	"ai_provider" text NOT NULL,
	"ai_model" text NOT NULL,
	"prompt_tokens" integer NOT NULL,
	"completion_tokens" integer NOT NULL,
	"cost_cents" integer NOT NULL,
	"results" jsonb NOT NULL,
	"status" text NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deck_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"card_type" text NOT NULL,
	"functional_role" text,
	"is_commander" boolean DEFAULT false NOT NULL,
	"is_companion" boolean DEFAULT false NOT NULL,
	"is_sideboard" boolean DEFAULT false NOT NULL,
	"user_note" text,
	"preferred_image_uris" jsonb,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "deck_cards_deck_id_card_id_unique" UNIQUE("deck_id","card_id")
);
--> statement-breakpoint
CREATE TABLE "deck_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"change_summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deck_versions_deck_id_version_number_unique" UNIQUE("deck_id","version_number")
);
--> statement-breakpoint
CREATE TABLE "decks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"commander_id" uuid NOT NULL,
	"partner_id" uuid,
	"format" text DEFAULT 'commander' NOT NULL,
	"target_bracket" integer NOT NULL,
	"playgroup_id" uuid,
	"budget_limit_cents" integer,
	"is_public" boolean DEFAULT true NOT NULL,
	"import_source" text,
	"import_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edhrec_commanders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"synergy_data" jsonb,
	"themes" jsonb,
	"avg_deck_stats" jsonb,
	"num_decks" integer NOT NULL,
	"cached_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "edhrec_commanders_card_id_unique" UNIQUE("card_id"),
	CONSTRAINT "edhrec_commanders_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "edhrec_salt_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"salt_score" numeric NOT NULL,
	"cached_at" timestamp with time zone NOT NULL,
	CONSTRAINT "edhrec_salt_scores_card_id_unique" UNIQUE("card_id")
);
--> statement-breakpoint
CREATE TABLE "match_card_performance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"performance" text NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "match_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"played_at" timestamp with time zone NOT NULL,
	"result" text NOT NULL,
	"player_count" integer NOT NULL,
	"turn_count" integer,
	"notes" text,
	"opponent_commanders" text[],
	"playgroup_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playgroup_members" (
	"playgroup_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"role" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "playgroup_members_playgroup_id_profile_id_pk" PRIMARY KEY("playgroup_id","profile_id")
);
--> statement-breakpoint
CREATE TABLE "playgroups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"target_bracket" integer NOT NULL,
	"max_salt_score" numeric,
	"house_rules" text,
	"banned_cards" uuid[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"default_bracket" integer DEFAULT 2 NOT NULL,
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "swap_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysis_id" uuid NOT NULL,
	"tier" text NOT NULL,
	"card_out_id" uuid,
	"card_in_id" uuid,
	"reasoning" text NOT NULL,
	"impact_summary" text NOT NULL,
	"tags" text[] NOT NULL,
	"synergy_score" numeric,
	"price_delta_cents" integer,
	"salt_delta" numeric,
	"sort_order" integer NOT NULL,
	"accepted" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deck_analyses" ADD CONSTRAINT "deck_analyses_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_analyses" ADD CONSTRAINT "deck_analyses_deck_version_id_deck_versions_id_fk" FOREIGN KEY ("deck_version_id") REFERENCES "public"."deck_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_cards" ADD CONSTRAINT "deck_cards_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_cards" ADD CONSTRAINT "deck_cards_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_versions" ADD CONSTRAINT "deck_versions_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_commander_id_cards_id_fk" FOREIGN KEY ("commander_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_partner_id_cards_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_playgroup_id_playgroups_id_fk" FOREIGN KEY ("playgroup_id") REFERENCES "public"."playgroups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edhrec_commanders" ADD CONSTRAINT "edhrec_commanders_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edhrec_salt_scores" ADD CONSTRAINT "edhrec_salt_scores_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_card_performance" ADD CONSTRAINT "match_card_performance_match_id_match_history_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."match_history"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_card_performance" ADD CONSTRAINT "match_card_performance_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_history" ADD CONSTRAINT "match_history_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_history" ADD CONSTRAINT "match_history_playgroup_id_playgroups_id_fk" FOREIGN KEY ("playgroup_id") REFERENCES "public"."playgroups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playgroup_members" ADD CONSTRAINT "playgroup_members_playgroup_id_playgroups_id_fk" FOREIGN KEY ("playgroup_id") REFERENCES "public"."playgroups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playgroup_members" ADD CONSTRAINT "playgroup_members_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playgroups" ADD CONSTRAINT "playgroups_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swap_recommendations" ADD CONSTRAINT "swap_recommendations_analysis_id_deck_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."deck_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swap_recommendations" ADD CONSTRAINT "swap_recommendations_card_out_id_cards_id_fk" FOREIGN KEY ("card_out_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swap_recommendations" ADD CONSTRAINT "swap_recommendations_card_in_id_cards_id_fk" FOREIGN KEY ("card_in_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_cards_oracle_id" ON "cards" USING btree ("oracle_id");--> statement-breakpoint
CREATE INDEX "idx_cards_name" ON "cards" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_cards_color_identity" ON "cards" USING gin ("color_identity");--> statement-breakpoint
CREATE INDEX "idx_cards_cmc" ON "cards" USING btree ("cmc");--> statement-breakpoint
CREATE INDEX "idx_deck_analyses_deck_id" ON "deck_analyses" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX "idx_deck_cards_deck_id" ON "deck_cards" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX "idx_deck_versions_deck_id" ON "deck_versions" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX "idx_decks_owner_id" ON "decks" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_decks_is_public" ON "decks" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "idx_edhrec_commanders_slug" ON "edhrec_commanders" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_edhrec_commanders_expires_at" ON "edhrec_commanders" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_edhrec_salt_scores_card_id" ON "edhrec_salt_scores" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "idx_match_card_performance_match_id" ON "match_card_performance" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "idx_match_history_deck_id" ON "match_history" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX "idx_playgroups_owner_id" ON "playgroups" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_swap_recommendations_analysis_id" ON "swap_recommendations" USING btree ("analysis_id");