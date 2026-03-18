import { getBracketLabel } from '@/lib/constants/brackets'
import { SENSIBLE_DEFAULTS, CATEGORY_LABELS } from '@/lib/constants/category-defaults'

function getSpicinessSection(spiciness: number): string {
  if (spiciness <= 15) return `
## Creativity Level: Meta Optimal (${spiciness}/100)
Recommend only the most proven, highest-win-rate cards. Prioritize cards that appear in 50%+ of decks with this commander. Pure optimization.`

  if (spiciness <= 35) return `
## Creativity Level: Tuned (${spiciness}/100)
Recommend strong, proven cards but allow 1-2 slightly off-meta picks if they have strong synergy. Favor consistency.`

  if (spiciness <= 65) return `
## Creativity Level: Balanced (${spiciness}/100)
Mix of proven staples and interesting alternatives. Include 2-3 lesser-known cards that synergize well. Balance power with personality.`

  if (spiciness <= 85) return `
## Creativity Level: Spicy (${spiciness}/100)
Prioritize interesting, underplayed cards. Include hidden gems and budget alternatives. Favor cards that create memorable moments over pure efficiency. At least half of recommendations should be cards most players haven't considered.`

  return `
## Creativity Level: Jank Paradise (${spiciness}/100)
Maximum creativity. Suggest the most unexpected, flavorful, and entertaining cards possible. Avoid anything that appears in more than 30% of decks. Embrace jank, combos nobody expects, and cards that make opponents say "wait, that card exists?"`
}

export function getRecommendationPrompt(context: {
  commander: string
  targetBracket: number
  budgetLimitCents: number | null
  cardCount: number
  cardList: string
  edhrecData: string | null
  philosophy?: string | null
  archetype?: string | null
  wildcardMode?: boolean
  spiciness?: number
  categoryTargets?: Record<string, number> | null
}) {
  const philosophySection = context.philosophy
    ? `## Deck Philosophy (HIGHEST PRIORITY)\nThe deck owner has specified: ${context.philosophy}\nALL recommendations MUST respect these constraints.\n\n`
    : ''

  const archetypeSection = context.archetype
    ? `Declared Archetype: ${context.archetype}. Recommendations should support this archetype.\n\n`
    : ''

  const categoryTargetLines = Object.entries(CATEGORY_LABELS).map(([key, label]) => {
    const target = context.categoryTargets?.[key] ?? SENSIBLE_DEFAULTS[key]
    return `- ${label}: ${target}`
  }).join('\n')

  const categorySection = `\n## Category Targets\nUse these targets when recommending cards to fill gaps:\n${categoryTargetLines}\n`

  const spiciness = context.spiciness ?? (context.wildcardMode ? 85 : 30)
  const spicinessSection = getSpicinessSection(spiciness)

  return `${philosophySection}${archetypeSection}You are an expert Magic: The Gathering Commander deck builder.${categorySection}

## Card Name Formatting (MANDATORY)
When mentioning any Magic card by name in your response text, ALWAYS wrap it in double brackets: [[Card Name]].
Examples: [[Sol Ring]], [[Kodama's Reach]], [[Thassa, Deep-Dwelling]].
This applies to ALL text fields: notes, reasoning, recommendations, mana_curve_notes, color_balance_notes, etc.
Do NOT bracket card names inside structured arrays (like the \`cards\` array in categories or \`card_roles\`).

## Task
Provide specific swap recommendations for this Commander deck. For each recommendation:
- Identify cards to cut (with reasoning)
- Suggest specific replacements (with reasoning)
- Tag each swap with its purpose (synergy, mana_fix, power_level, budget, salt_reduction, curve)

## Constraints
- Target Bracket: ${context.targetBracket} (${getBracketLabel(context.targetBracket)})
${context.budgetLimitCents ? `- Budget Limit: $${(context.budgetLimitCents / 100).toFixed(2)} - do NOT suggest cards that would push the deck over budget` : ''}
- Only suggest cards legal in Commander format
- Consider the commander's strategy and synergies

## Tier Definitions
- must_cut: Cards that actively harm the deck's strategy or are clearly too weak
- consider_cutting: Cards that could be improved upon
- must_add: Essential cards the deck is missing for its strategy
- consider_adding: Good additions that would improve the deck

## Current Deck
Commander: ${context.commander}
Card Count: ${context.cardCount}/100

### Card List
${context.cardList}

${context.edhrecData ? `### EDHREC Synergy Data\n${context.edhrecData}` : ''}

Provide 8-15 recommendations, prioritized by impact.${spicinessSection}`
}
