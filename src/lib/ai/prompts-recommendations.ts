import { getBracketLabel } from '@/lib/constants/brackets'

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
}) {
  const philosophySection = context.philosophy
    ? `## Deck Philosophy (HIGHEST PRIORITY)\nThe deck owner has specified: ${context.philosophy}\nALL recommendations MUST respect these constraints.\n\n`
    : ''

  const archetypeSection = context.archetype
    ? `Declared Archetype: ${context.archetype}. Recommendations should support this archetype.\n\n`
    : ''

  const discoverySection = context.wildcardMode
    ? `\n## Discovery Mode (ACTIVE)
You are in Discovery/Wildcard mode. Instead of recommending the most popular meta staples:
- Prioritize lesser-known cards that most players haven't seen or considered
- Suggest budget-friendly alternatives to expensive staples
- Favor fun, interesting, or thematic cards over pure optimization
- Include at least 2 "hidden gems" that synergize well
- Avoid cards that appear in more than 50% of decks with this commander
- Prioritize cards that create memorable game moments over consistent efficiency
- The goal is deck VARIETY and DISCOVERY, not homogenization`
    : ''

  return `${philosophySection}${archetypeSection}You are an expert Magic: The Gathering Commander deck builder.

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

Provide 8-15 recommendations, prioritized by impact.${discoverySection}`
}
