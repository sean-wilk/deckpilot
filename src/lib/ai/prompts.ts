import { GAME_CHANGERS, getBracketLabel } from '@/lib/constants/brackets'

export function getAnalysisPrompt(context: {
  commander: string
  targetBracket: number
  budgetLimitCents: number | null
  cardCount: number
  cardList: string
  edhrecData: string | null
  philosophy?: string | null
  archetype?: string | null
}) {
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
${
  context.targetBracket <= 2
    ? `
- Ramp: 8-10 sources
- Card Draw: 8-10 sources
- Targeted Removal: 7-10
- Board Wipes: 2-4
- Win Conditions: 3-5
- Protection: 3-5
- Lands: 35-38`
    : context.targetBracket === 3
    ? `
- Ramp: 9-12 sources
- Card Draw: 9-12 sources
- Targeted Removal: 8-11
- Board Wipes: 2-4
- Win Conditions: 3-5
- Protection: 4-6
- Lands: 33-36`
    : `
- Ramp: 10-14 sources
- Card Draw: 10-14 sources
- Targeted Removal: 8-12
- Board Wipes: 2-4
- Win Conditions: 3-5
- Protection: 4-6
- Lands: 30-34`
}

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

## Task
Analyze this Commander deck thoroughly. Evaluate each functional category, assess the mana base, identify synergies and dead cards, estimate power level bracket, and assess salt level.`
}
