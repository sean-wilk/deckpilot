ALTER TABLE "deck_analyses" ADD COLUMN "card_name" text;--> statement-breakpoint
CREATE INDEX "idx_deck_analyses_card" ON "deck_analyses" USING btree ("deck_id","analysis_type","card_name");