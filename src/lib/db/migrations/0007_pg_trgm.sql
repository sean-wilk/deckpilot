-- Enable pg_trgm extension for fuzzy text matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add trigram index on card names for fast similarity search
CREATE INDEX idx_cards_name_trgm ON cards USING gin (name gin_trgm_ops);
