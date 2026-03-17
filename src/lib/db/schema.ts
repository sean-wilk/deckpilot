import {
  pgTable,
  uuid,
  text,
  numeric,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  unique,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ─── Cards ───────────────────────────────────────────────────────────────────

export const cards = pgTable(
  "cards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scryfallId: text("scryfall_id").unique(),
    oracleId: text("oracle_id").unique(),
    name: text("name").notNull(),
    manaCost: text("mana_cost"),
    cmc: numeric("cmc").notNull(),
    typeLine: text("type_line").notNull(),
    oracleText: text("oracle_text"),
    colors: text("colors").array().notNull(),
    colorIdentity: text("color_identity").array().notNull(),
    power: text("power"),
    toughness: text("toughness"),
    keywords: text("keywords").array().notNull(),
    legalities: jsonb("legalities").notNull(),
    rarity: text("rarity").notNull(),
    setCode: text("set_code").notNull(),
    imageUris: jsonb("image_uris"),
    cardFaces: jsonb("card_faces"),
    prices: jsonb("prices").notNull(),
    edhrecRank: integer("edhrec_rank"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("idx_cards_oracle_id").on(table.oracleId),
    index("idx_cards_name").on(table.name),
    index("idx_cards_color_identity").using("gin", table.colorIdentity),
    index("idx_cards_cmc").on(table.cmc),
  ]
);

// ─── EDHREC Commanders ──────────────────────────────────────────────────────

export const edhrecCommanders = pgTable(
  "edhrec_commanders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cardId: uuid("card_id")
      .references(() => cards.id)
      .unique()
      .notNull(),
    slug: text("slug").unique().notNull(),
    synergyData: jsonb("synergy_data"),
    themes: jsonb("themes"),
    avgDeckStats: jsonb("avg_deck_stats"),
    numDecks: integer("num_decks").notNull(),
    cachedAt: timestamp("cached_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("idx_edhrec_commanders_slug").on(table.slug),
    index("idx_edhrec_commanders_expires_at").on(table.expiresAt),
  ]
);

// ─── EDHREC Salt Scores ─────────────────────────────────────────────────────

export const edhrecSaltScores = pgTable(
  "edhrec_salt_scores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cardId: uuid("card_id")
      .references(() => cards.id)
      .unique()
      .notNull(),
    saltScore: numeric("salt_score").notNull(),
    cachedAt: timestamp("cached_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("idx_edhrec_salt_scores_card_id").on(table.cardId)]
);

// ─── Profiles ────────────────────────────────────────────────────────────────

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // references auth.users, not a Drizzle FK
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  defaultBracket: integer("default_bracket").default(2).notNull(),
  isSuperAdmin: boolean("is_super_admin").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Admin AI Config ─────────────────────────────────────────────────────────

export const adminAiConfig = pgTable("admin_ai_config", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: text("provider").notNull(),
  modelAnalysis: text("model_analysis").notNull(),
  modelRecommendations: text("model_recommendations").notNull(),
  modelChat: text("model_chat").notNull(),
  modelGeneration: text("model_generation").notNull(),
  apiKeyEncrypted: text("api_key_encrypted").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  usageLimitDailyCents: integer("usage_limit_daily_cents"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Playgroups ──────────────────────────────────────────────────────────────

export const playgroups = pgTable(
  "playgroups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    ownerId: uuid("owner_id")
      .references(() => profiles.id)
      .notNull(),
    targetBracket: integer("target_bracket").notNull(),
    maxSaltScore: numeric("max_salt_score"),
    houseRules: text("house_rules"),
    bannedCards: uuid("banned_cards")
      .array()
      .default(sql`'{}'`)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_playgroups_owner_id").on(table.ownerId)]
);

// ─── Playgroup Members ───────────────────────────────────────────────────────

export const playgroupMembers = pgTable(
  "playgroup_members",
  {
    playgroupId: uuid("playgroup_id")
      .references(() => playgroups.id)
      .notNull(),
    profileId: uuid("profile_id")
      .references(() => profiles.id)
      .notNull(),
    role: text("role", { enum: ["owner", "member"] }).notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.playgroupId, table.profileId] })]
);

// ─── Decks ───────────────────────────────────────────────────────────────────

export const decks = pgTable(
  "decks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .references(() => profiles.id)
      .notNull(),
    name: text("name").notNull(),
    description: text("description"),
    commanderId: uuid("commander_id")
      .references(() => cards.id)
      .notNull(),
    partnerId: uuid("partner_id").references(() => cards.id),
    format: text("format").default("commander").notNull(),
    targetBracket: integer("target_bracket").notNull(),
    playgroupId: uuid("playgroup_id").references(() => playgroups.id),
    budgetLimitCents: integer("budget_limit_cents"),
    isPublic: boolean("is_public").default(true).notNull(),
    importSource: text("import_source"),
    importUrl: text("import_url"),
    philosophy: text("philosophy"),
    archetype: text("archetype"),
    categoryTargets: jsonb("category_targets"),
    landCountTarget: integer("land_count_target"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_decks_owner_id").on(table.ownerId),
    index("idx_decks_is_public").on(table.isPublic),
  ]
);

// ─── Deck Cards ──────────────────────────────────────────────────────────────

export const deckCards = pgTable(
  "deck_cards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    deckId: uuid("deck_id")
      .references(() => decks.id, { onDelete: "cascade" })
      .notNull(),
    cardId: uuid("card_id")
      .references(() => cards.id)
      .notNull(),
    quantity: integer("quantity").default(1).notNull(),
    cardType: text("card_type").notNull(),
    functionalRole: text("functional_role"),
    isCommander: boolean("is_commander").default(false).notNull(),
    isCompanion: boolean("is_companion").default(false).notNull(),
    isSideboard: boolean("is_sideboard").default(false).notNull(),
    userNote: text("user_note"),
    preferredImageUris: jsonb("preferred_image_uris"),
    addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [
    index("idx_deck_cards_deck_id").on(table.deckId),
    unique("deck_cards_deck_id_card_id_unique").on(table.deckId, table.cardId),
  ]
);

// ─── Deck Versions ───────────────────────────────────────────────────────────

export const deckVersions = pgTable(
  "deck_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    deckId: uuid("deck_id")
      .references(() => decks.id, { onDelete: "cascade" })
      .notNull(),
    versionNumber: integer("version_number").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    changeSummary: text("change_summary").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_deck_versions_deck_id").on(table.deckId),
    unique("deck_versions_deck_id_version_number_unique").on(
      table.deckId,
      table.versionNumber
    ),
  ]
);

// ─── Deck Analyses ───────────────────────────────────────────────────────────

export const deckAnalyses = pgTable(
  "deck_analyses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    deckId: uuid("deck_id")
      .references(() => decks.id, { onDelete: "cascade" })
      .notNull(),
    deckVersionId: uuid("deck_version_id").references(() => deckVersions.id),
    analysisType: text("analysis_type").notNull(),
    aiProvider: text("ai_provider").notNull(),
    aiModel: text("ai_model").notNull(),
    promptTokens: integer("prompt_tokens").notNull(),
    completionTokens: integer("completion_tokens").notNull(),
    costCents: integer("cost_cents").notNull(),
    results: jsonb("results").notNull(),
    status: text("status").notNull(),
    errorMessage: text("error_message"),
    cardName: text("card_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_deck_analyses_deck_id").on(table.deckId),
    index("idx_deck_analyses_card").on(table.deckId, table.analysisType, table.cardName),
  ]
);

// ─── Swap Recommendations ────────────────────────────────────────────────────

export const swapRecommendations = pgTable(
  "swap_recommendations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    analysisId: uuid("analysis_id")
      .references(() => deckAnalyses.id, { onDelete: "cascade" })
      .notNull(),
    tier: text("tier").notNull(),
    cardOutId: uuid("card_out_id").references(() => cards.id),
    cardInId: uuid("card_in_id").references(() => cards.id),
    reasoning: text("reasoning").notNull(),
    impactSummary: text("impact_summary").notNull(),
    tags: text("tags").array().notNull(),
    synergyScore: numeric("synergy_score"),
    priceDeltaCents: integer("price_delta_cents"),
    saltDelta: numeric("salt_delta"),
    sortOrder: integer("sort_order").notNull(),
    accepted: boolean("accepted"),
    dismissed: boolean("dismissed").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_swap_recommendations_analysis_id").on(table.analysisId)]
);

// ─── Match History ───────────────────────────────────────────────────────────

export const matchHistory = pgTable(
  "match_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    deckId: uuid("deck_id")
      .references(() => decks.id, { onDelete: "cascade" })
      .notNull(),
    playedAt: timestamp("played_at", { withTimezone: true }).notNull(),
    result: text("result").notNull(),
    playerCount: integer("player_count").notNull(),
    turnCount: integer("turn_count"),
    notes: text("notes"),
    opponentCommanders: text("opponent_commanders").array(),
    playgroupId: uuid("playgroup_id").references(() => playgroups.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_match_history_deck_id").on(table.deckId)]
);

// ─── Match Card Performance ──────────────────────────────────────────────────

export const matchCardPerformance = pgTable(
  "match_card_performance",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    matchId: uuid("match_id")
      .references(() => matchHistory.id, { onDelete: "cascade" })
      .notNull(),
    cardId: uuid("card_id")
      .references(() => cards.id)
      .notNull(),
    performance: text("performance").notNull(),
    note: text("note"),
  },
  (table) => [index("idx_match_card_performance_match_id").on(table.matchId)]
);

// ═══════════════════════════════════════════════════════════════════════════════
// RELATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const cardsRelations = relations(cards, ({ many }) => ({
  edhrecCommander: many(edhrecCommanders),
  edhrecSaltScore: many(edhrecSaltScores),
  deckCards: many(deckCards),
  decksAsCommander: many(decks, { relationName: "commander" }),
  decksAsPartner: many(decks, { relationName: "partner" }),
  swapRecommendationsOut: many(swapRecommendations, { relationName: "cardOut" }),
  swapRecommendationsIn: many(swapRecommendations, { relationName: "cardIn" }),
  matchCardPerformances: many(matchCardPerformance),
}));

export const edhrecCommandersRelations = relations(edhrecCommanders, ({ one }) => ({
  card: one(cards, {
    fields: [edhrecCommanders.cardId],
    references: [cards.id],
  }),
}));

export const edhrecSaltScoresRelations = relations(edhrecSaltScores, ({ one }) => ({
  card: one(cards, {
    fields: [edhrecSaltScores.cardId],
    references: [cards.id],
  }),
}));

export const profilesRelations = relations(profiles, ({ many }) => ({
  playgroups: many(playgroups),
  playgroupMemberships: many(playgroupMembers),
  decks: many(decks),
}));

export const playgroupsRelations = relations(playgroups, ({ one, many }) => ({
  owner: one(profiles, {
    fields: [playgroups.ownerId],
    references: [profiles.id],
  }),
  members: many(playgroupMembers),
  decks: many(decks),
  matches: many(matchHistory),
}));

export const playgroupMembersRelations = relations(playgroupMembers, ({ one }) => ({
  playgroup: one(playgroups, {
    fields: [playgroupMembers.playgroupId],
    references: [playgroups.id],
  }),
  profile: one(profiles, {
    fields: [playgroupMembers.profileId],
    references: [profiles.id],
  }),
}));

export const decksRelations = relations(decks, ({ one, many }) => ({
  owner: one(profiles, {
    fields: [decks.ownerId],
    references: [profiles.id],
  }),
  commander: one(cards, {
    fields: [decks.commanderId],
    references: [cards.id],
    relationName: "commander",
  }),
  partner: one(cards, {
    fields: [decks.partnerId],
    references: [cards.id],
    relationName: "partner",
  }),
  playgroup: one(playgroups, {
    fields: [decks.playgroupId],
    references: [playgroups.id],
  }),
  deckCards: many(deckCards),
  versions: many(deckVersions),
  analyses: many(deckAnalyses),
  matches: many(matchHistory),
}));

export const deckCardsRelations = relations(deckCards, ({ one }) => ({
  deck: one(decks, {
    fields: [deckCards.deckId],
    references: [decks.id],
  }),
  card: one(cards, {
    fields: [deckCards.cardId],
    references: [cards.id],
  }),
}));

export const deckVersionsRelations = relations(deckVersions, ({ one, many }) => ({
  deck: one(decks, {
    fields: [deckVersions.deckId],
    references: [decks.id],
  }),
  analyses: many(deckAnalyses),
}));

export const deckAnalysesRelations = relations(deckAnalyses, ({ one, many }) => ({
  deck: one(decks, {
    fields: [deckAnalyses.deckId],
    references: [decks.id],
  }),
  deckVersion: one(deckVersions, {
    fields: [deckAnalyses.deckVersionId],
    references: [deckVersions.id],
  }),
  swapRecommendations: many(swapRecommendations),
}));

export const swapRecommendationsRelations = relations(swapRecommendations, ({ one }) => ({
  analysis: one(deckAnalyses, {
    fields: [swapRecommendations.analysisId],
    references: [deckAnalyses.id],
  }),
  cardOut: one(cards, {
    fields: [swapRecommendations.cardOutId],
    references: [cards.id],
    relationName: "cardOut",
  }),
  cardIn: one(cards, {
    fields: [swapRecommendations.cardInId],
    references: [cards.id],
    relationName: "cardIn",
  }),
}));

export const matchHistoryRelations = relations(matchHistory, ({ one, many }) => ({
  deck: one(decks, {
    fields: [matchHistory.deckId],
    references: [decks.id],
  }),
  playgroup: one(playgroups, {
    fields: [matchHistory.playgroupId],
    references: [playgroups.id],
  }),
  cardPerformances: many(matchCardPerformance),
}));

export const matchCardPerformanceRelations = relations(matchCardPerformance, ({ one }) => ({
  match: one(matchHistory, {
    fields: [matchCardPerformance.matchId],
    references: [matchHistory.id],
  }),
  card: one(cards, {
    fields: [matchCardPerformance.cardId],
    references: [cards.id],
  }),
}));
