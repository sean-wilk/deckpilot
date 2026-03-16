export function getManaFixingPrompt(context: {
  commander: string
  targetBracket: number
  budgetLimitCents: number | null
  cardList: string
  colorIdentity?: string[]
  currentLands?: string
  colorRequirements?: Record<string, number>
  colorProduction?: Record<string, number>
  [key: string]: unknown
}) {
  return `You are an expert MTG Commander mana base builder.

## Task
Recommend specific land improvements for this Commander deck.

Commander: ${context.commander}
Target Bracket: ${context.targetBracket}
Color Identity: ${context.colorIdentity ? context.colorIdentity.join(', ') : 'Unknown'}
${context.budgetLimitCents ? `Budget Limit: $${(context.budgetLimitCents / 100).toFixed(2)}` : ''}
${context.currentLands ? `\n## Current Mana Base\n${context.currentLands}` : ''}
${context.colorRequirements && Object.keys(context.colorRequirements).length > 0 ? `\n## Color Requirements (pips from non-land cards)\n${Object.entries(context.colorRequirements).map(([c, n]) => `${c}: ${n} pips`).join(', ')}` : ''}
${context.colorProduction && Object.keys(context.colorProduction).length > 0 ? `\n## Current Color Production\n${Object.entries(context.colorProduction).map(([c, n]) => `${c}: ${n} sources`).join(', ')}` : ''}

## Instructions
- Suggest specific dual lands, fetch lands, and fixing appropriate for Bracket ${context.targetBracket}
- Consider budget constraints
- For B1-2: mostly taplands, guildgates, gain lands
- For B3: check lands, fast lands, pain lands
- For B4-5: fetch lands, shock lands, original duals if budget allows
- Identify underperforming lands to cut
- Suggest utility lands that support the deck's strategy`
}
