import { z } from 'zod'

const categoryRating = z.enum([
  'deficient',
  'low',
  'adequate',
  'strong',
  'excessive',
])

const categorySchema = z.object({
  count: z.number(),
  target: z.number(),
  rating: categoryRating,
  cards: z.array(z.string()),
  notes: z.string(),
})

export const DeckAnalysisSchema = z.object({
  overall_assessment: z.string(),
  power_level_estimate: z.object({
    bracket: z.number().min(1).max(4),
    confidence: z.number().min(0).max(1),
    reasoning: z.string(),
  }),
  categories: z.object({
    ramp: categorySchema,
    card_draw: categorySchema,
    removal: categorySchema,
    board_wipes: categorySchema,
    win_conditions: categorySchema,
    protection: categorySchema,
    lands: categorySchema,
  }),
  mana_base: z.object({
    land_count: z.number(),
    recommended_land_count: z.number(),
    color_balance: z.record(z.string(), z.number()),
    color_pip_requirements: z.record(z.string(), z.number()),
    fixing_quality: z.enum(['poor', 'fair', 'good', 'excellent']),
    notes: z.string(),
  }),
  synergy: z.object({
    score: z.number().min(0).max(10),
    key_synergies: z.array(
      z.object({ cards: z.array(z.string()), description: z.string() })
    ),
    dead_cards: z.array(
      z.object({ card: z.string(), reasoning: z.string() })
    ),
    detected_combos: z.array(
      z.object({
        cards: z.array(z.string()),
        description: z.string(),
        is_infinite: z.boolean(),
      })
    ),
  }),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  salt_assessment: z.object({
    total_salt: z.number(),
    high_salt_cards: z.array(
      z.object({ card: z.string(), salt_score: z.number() })
    ),
    notes: z.string(),
  }),
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
  estimated_bracket_after: z.number().min(1).max(4),
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
  estimated_bracket: z.number().min(1).max(4),
})

export type DeckAnalysis = z.infer<typeof DeckAnalysisSchema>
export type SwapRecommendation = z.infer<typeof SwapRecommendationSchema>
export type FindReplacement = z.infer<typeof FindReplacementSchema>
export type CommanderSuggestions = z.infer<typeof CommanderSuggestionsSchema>
export type GeneratedDeck = z.infer<typeof GeneratedDeckSchema>
