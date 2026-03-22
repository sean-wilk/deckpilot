export function getManaFixingPrompt(context: {
  commander: string
  targetBracket: number
  budgetLimitCents: number | null
  cardCount: number
  cardList: string
  colorIdentity?: string[]
}) {
  return `You are an expert MTG Commander mana base analyst.

## Task
Perform a comprehensive mana base analysis for this Commander deck. Analyze the full decklist below to determine land count, color production sources, color pip requirements from non-land cards, fixing sources, and balance.

Commander: ${context.commander}
Target Bracket: ${context.targetBracket}
Color Identity: ${context.colorIdentity?.join(', ') ?? 'Unknown'}
${context.budgetLimitCents ? `Budget Limit: $${(context.budgetLimitCents / 100).toFixed(2)}` : ''}

## Full Decklist
${context.cardList}

## Instructions
1. Identify ALL lands in the decklist. Count basics vs nonbasics.
2. For each land, determine which colors of mana it can produce.
3. For each non-land card, count the colored mana pips in its mana cost.
4. Compare color production to color requirements to assess balance.
5. Identify fixing sources (lands producing 2+ colors) and utility lands.

## Card Name Formatting (MANDATORY)
When mentioning any Magic card by name, ALWAYS wrap it in double brackets: [[Card Name]].

## Required Output Fields
- total_lands: number — current total land count
- target_lands: number — recommended land count for this deck
- basic_count: number — count of basic lands
- nonbasic_count: number — count of nonbasic lands
- color_production: object — { W, U, B, R, G } counts of sources producing each color (omit colors not in identity)
- color_requirements: object — { W, U, B, R, G } pip counts required by non-land cards (omit colors not in identity)
- fixing_sources: number — count of lands that produce 2+ colors
- utility_lands: number — count of lands with non-mana abilities
- mana_curve_notes: string — analysis of how the mana base supports the deck's curve (2-4 sentences with card references)
- color_balance_notes: string — analysis of color balance vs requirements (2-4 sentences with card references)
- fixing_quality: string — overall quality rating: "poor", "fair", "good", or "excellent"
- recommendations: string[] — array of 3-8 actionable recommendations for improving the mana base`
}
