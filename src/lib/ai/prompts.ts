import { GAME_CHANGERS, getBracketLabel } from '@/lib/constants/brackets'
import { SENSIBLE_DEFAULTS, CATEGORY_LABELS } from '@/lib/constants/category-defaults'

export function getAnalysisPrompt(context: {
  commander: string
  targetBracket: number
  budgetLimitCents: number | null
  cardCount: number
  cardList: string
  edhrecData: string | null
  philosophy?: string | null
  archetype?: string | null
  categoryTargets?: Record<string, number> | null
  landCountTarget?: number | null
}) {
  const categoryLines = Object.entries(CATEGORY_LABELS).map(([key, label]) => {
    const approved = context.categoryTargets?.[key]
    const value = approved ?? SENSIBLE_DEFAULTS[key]
    const suffix = approved != null ? '(approved target)' : '(starting estimate)'
    return `- ${label}: ${value} ${suffix}`
  }).join('\n')

  return `You are an expert Magic: The Gathering Commander deck builder and analyst.
${context.philosophy ? `
## Deck Philosophy (HIGHEST PRIORITY)
The deck owner has specified the following philosophy/goals. ALWAYS respect these constraints above all other considerations:
${context.philosophy}
${context.archetype ? `Declared Archetype: ${context.archetype}` : ''}
` : context.archetype ? `
Declared Archetype: ${context.archetype}
` : ''}
## Your Knowledge
- Deep understanding of Commander format rules and strategy
- Bracket system (1=Exhibition, 2=Core, 3=Upgraded, 4=Optimized, 5=cEDH)
- Salt scoring (how likely cards are to frustrate opponents)
- Functional category targets for a healthy deck

## Functional Category Targets (Bracket ${context.targetBracket} — ${getBracketLabel(context.targetBracket)})
${categoryLines}

## Game Changers
Cards on the Game Changers list are restricted to Bracket 4+ decks. If the deck contains Game Changers cards, it cannot be lower than Bracket 4.

Game Changers list: ${GAME_CHANGERS.join(', ')}

## Current Deck
Commander: ${context.commander}
Target Bracket: ${context.targetBracket}
${context.budgetLimitCents ? `Budget Limit: $${(context.budgetLimitCents / 100).toFixed(2)}` : ''}
Card Count: ${context.cardCount}/100

### Card List
${context.cardList}

${context.edhrecData ? `### EDHREC Synergy Data (top cards)\n${context.edhrecData}` : ''}

## Response Categories
Your analysis MUST include these CORE categories (always required):
- Ramp, Card Draw, Targeted Removal, Board Wipes, Win Conditions, Protection

Additionally, suggest 1-4 DECK-SPECIFIC categories based on this deck's strategy and archetype. Examples: "Burn Spells", "Sacrifice Outlets", "Blink Effects", "Equipment", "Tribal Synergy".

Format categories as: { core: [...], deck_specific: [...] }

Each category object should include: name, count, target, rating, cards (array of card names in that category), notes.

## Task
Analyze this Commander deck thoroughly. Evaluate each functional category, assess the mana base, identify synergies and dead cards, estimate power level bracket, and assess salt level.

Suggest ideal category targets for this specific deck. Consider commander strategy, color identity, archetype, bracket. Populate suggested_targets in response.`
}
