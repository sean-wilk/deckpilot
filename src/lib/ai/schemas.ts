import { z } from 'zod'

// Simplified schema for Anthropic compatibility (avoids grammar size limits)
export const DeckAnalysisSchema = z.object({
  overall_assessment: z.string(),
  bracket: z.number(),
  bracket_confidence: z.number(),
  bracket_reasoning: z.string(),
  categories: z.array(z.object({
    name: z.string(),
    count: z.number(),
    target: z.number(),
    rating: z.string(),
    notes: z.string(),
  })),
  land_count: z.number(),
  recommended_land_count: z.number(),
  mana_base_notes: z.string(),
  fixing_quality: z.string(),
  synergy_score: z.number(),
  key_synergies: z.array(z.string()),
  dead_cards: z.array(z.string()),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  salt_total: z.number(),
  salt_notes: z.string(),
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
    play_style: z.string(),
    synergy_notes: z.string(),
    why_this_commander: z.string(),
  })),
})

export const GeneratedDeckSchema = z.object({
  cards: z.array(z.object({
    name: z.string(),
    category: z.string(),
    reasoning: z.string(),
  })),
  strategy_summary: z.string(),
  estimated_bracket: z.number(),
})

export type DeckAnalysis = z.infer<typeof DeckAnalysisSchema>
export type SwapRecommendation = z.infer<typeof SwapRecommendationSchema>
export type FindReplacement = z.infer<typeof FindReplacementSchema>
export type CommanderSuggestions = z.infer<typeof CommanderSuggestionsSchema>
export type GeneratedDeck = z.infer<typeof GeneratedDeckSchema>
