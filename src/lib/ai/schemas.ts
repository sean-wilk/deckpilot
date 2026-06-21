import { z } from 'zod'

const CoreCategoryName = z.enum([
  'Ramp', 'Card Draw', 'Targeted Removal', 'Board Wipes', 'Win Conditions', 'Protection'
])

const CoreCategorySchema = z.object({
  name: CoreCategoryName,
  count: z.number(),
  target: z.number(),
  rating: z.string(),
  cards: z.array(z.string()).default([]),
  notes: z.string(),
})

const DeckSpecificCategorySchema = z.object({
  name: z.string(),
  count: z.number(),
  target: z.number(),
  rating: z.string(),
  cards: z.array(z.string()).default([]),
  notes: z.string(),
})

const CategoriesObjectSchema = z.object({
  core: z.array(CoreCategorySchema),
  deck_specific: z.array(DeckSpecificCategorySchema).default([]),
})

// Simplified schema for Anthropic compatibility (avoids grammar size limits)
export const DeckAnalysisSchema = z.object({
  overall_assessment: z.string(),
  bracket: z.number(),
  bracket_confidence: z.number(),
  bracket_reasoning: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  salt_total: z.number(),
  salt_notes: z.string(),
  structureSummary: z.string().optional().describe('Brief 2-3 sentence overview of category health'),
  categories: CategoriesObjectSchema.optional(),
  land_count: z.number(),
  recommended_land_count: z.number(),
  mana_base_notes: z.string(),
  fixing_quality: z.string(),
  synergy_score: z.number(),
  key_synergies: z.array(z.string()),
  dead_cards: z.array(z.string()),
  suggested_targets: z.array(z.object({
    category: z.string(),
    target_count: z.number(),
    reasoning: z.string(),
  })).optional(),
})

/** Standalone schema for the Mana Fixing tab's dedicated analysis */
export const LandsAnalysisSchema = z.object({
  total_lands: z.number(),
  target_lands: z.number(),
  basic_count: z.number(),
  nonbasic_count: z.number(),
  color_production: z.object({ W: z.number(), U: z.number(), B: z.number(), R: z.number(), G: z.number() }).partial(),
  color_requirements: z.object({ W: z.number(), U: z.number(), B: z.number(), R: z.number(), G: z.number() }).partial(),
  fixing_sources: z.number(),
  utility_lands: z.number(),
  mana_curve_notes: z.string(),
  color_balance_notes: z.string(),
  fixing_quality: z.string(),
  recommendations: z.array(z.string()),
})

export const SwapRecommendationSchema = z.object({
  recommendations: z.array(
    z.object({
      tier: z.enum([
        'must_cut',
        'consider_cutting',
        'must_add',
        'consider_adding',
      ]),
      card_out: z.string().nullable(),
      card_in: z.string().nullable(),
      reasoning: z.string(),
      impact_summary: z.string(),
      tags: z.array(
        z.enum([
          'synergy',
          'mana_fix',
          'power_level',
          'budget',
          'salt_reduction',
          'curve',
        ])
      ),
    })
  ),
  summary: z.string(),
  estimated_bracket_after: z.number(),
  estimated_price_delta_cents: z.number(),
})

export const FindReplacementSchema = z.object({
  replacements: z.array(z.object({
    card_name: z.string(),
    reasoning: z.string(),
    synergy_notes: z.string(),
    estimated_price_usd: z.string().nullable(),
  })),
  context: z.string(), // Brief explanation of why the original card might be replaced
})

export const CommanderSuggestionsSchema = z.object({
  suggestions: z.array(z.object({
    name: z.string(),
    color_identity: z.array(z.string()),
    match_score: z.number(),
    play_style: z.string(),
    synergy_description: z.string(),
    why_this_commander: z.string(),
  })),
})

export type LandsAnalysis = z.infer<typeof LandsAnalysisSchema>
export type DeckAnalysis = z.infer<typeof DeckAnalysisSchema>
export type SwapRecommendation = z.infer<typeof SwapRecommendationSchema>
export type FindReplacement = z.infer<typeof FindReplacementSchema>
export type CommanderSuggestions = z.infer<typeof CommanderSuggestionsSchema>
