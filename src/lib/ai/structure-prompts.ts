import { SENSIBLE_DEFAULTS, CATEGORY_LABELS } from '@/lib/constants/category-defaults'

// Type for deck context passed to structure prompt builders.
// Cards are pre-filtered from the db join on deckCards + cards tables.
// isSideboard is derived by the caller from deckCards.cardType === 'sideboard'.
export interface StructurePromptContext {
  commanderName: string
  commanderColorIdentity: string[]
  cards: Array<{
    name: string
    typeLine: string
    oracleText: string | null
    manaCost: string | null
    isCommander: boolean
    isSideboard: boolean
  }>
  philosophy?: string | null
  archetype?: string | null
  targetBracket?: number | null
  categoryTargets?: Record<string, number> | null
  customCategories?: string[] | null
  manualOverrides?: Array<{ cardName: string; category: string }>
}

// Core category keys in CATEGORY_LABELS order, excluding lands (handled separately)
const CORE_CATEGORY_KEYS = ['ramp', 'cardDraw', 'targetedRemoval', 'boardWipes', 'winConditions', 'protection'] as const

export function getStructureStrategyPrompt(context: StructurePromptContext): string {
  const deckCards = context.cards.filter(c => !c.isSideboard)

  const landCount = deckCards.filter(c => c.typeLine.toLowerCase().includes('land')).length
  const nonLandCount = deckCards.filter(c => !c.typeLine.toLowerCase().includes('land')).length

  const cardList = deckCards
    .map(c => {
      const parts = [`${c.name} (${c.typeLine})`]
      if (c.oracleText) parts.push(`— ${c.oracleText}`)
      if (c.isCommander) parts.push('[COMMANDER]')
      return parts.join(' ')
    })
    .join('\n')

  const targetLines = CORE_CATEGORY_KEYS.map(key => {
    const label = CATEGORY_LABELS[key]
    const approved = context.categoryTargets?.[key]
    const defaultVal = SENSIBLE_DEFAULTS[key]
    return `- ${label}: ${approved != null ? `${approved} (user-set)` : `${defaultVal} (default)`}`
  }).join('\n')

  const landTargetLine = (() => {
    const approved = context.categoryTargets?.['lands']
    const defaultVal = SENSIBLE_DEFAULTS['lands']
    return `- Lands: ${approved != null ? `${approved} (user-set)` : `${defaultVal} (default)`}`
  })()

  const customCatSection = context.customCategories?.length
    ? `\n\n## User-Defined Custom Categories\nInclude these additional categories in your analysis:\n${context.customCategories.map(c => `- ${c}`).join('\n')}`
    : ''

  const philosophySection = context.philosophy
    ? `\n## Deck Philosophy\n${context.philosophy}${context.archetype ? `\nDeclared Archetype: ${context.archetype}` : ''}`
    : context.archetype
    ? `\n## Archetype\n${context.archetype}`
    : ''

  const bracketSection = context.targetBracket ? `\n## Target Bracket\n${context.targetBracket}/5` : ''

  return `You are an expert Magic: The Gathering Commander deck analyst. Analyze this deck's functional structure.

## Commander
${context.commanderName} (Colors: ${context.commanderColorIdentity.join(', ')})

## Deck Stats
- Non-land cards: ${nonLandCount}
- Lands: ${landCount}
- Total: ${deckCards.length}
${philosophySection}${bracketSection}

## Current Category Targets
${targetLines}
${landTargetLine}
${customCatSection}

## Card List
${cardList}

## Instructions

Analyze this deck's functional structure. You MUST:

1. Evaluate all 6 core categories: Ramp, Card Draw, Targeted Removal, Board Wipes, Win Conditions, Protection
2. Identify 1-4 deck-specific categories based on this deck's strategy (e.g., "Sacrifice Outlets", "Blink Effects", "Equipment", "Tribal Synergy")
3. For each category:
   - Set a recommended target count
   - Count how many cards currently serve this role
   - Rate the category: excessive/strong/adequate/low/deficient
   - Write notes explaining the assessment. MANDATORY: Wrap all card names in [[double brackets]]
4. Provide a 2-3 sentence summary of overall structure health
5. Provide a gap analysis of what the deck is missing structurally

Generate a slug for each category (lowercase, hyphens, e.g., "card-draw", "sacrifice-outlets"). Core category slugs: ramp, card-draw, targeted-removal, board-wipes, win-conditions, protection.

Mark isCore: true for the 6 core categories, false for deck-specific categories.

Respond with valid JSON matching this exact structure:
{
  "categories": [{ "name": "...", "slug": "...", "isCore": true, "target": 10, "currentCount": 8, "rating": "adequate", "notes": "..." }],
  "landTarget": 36,
  "summary": "...",
  "gapAnalysis": "..."
}`
}

export function getStructureAssignmentPrompt(
  context: StructurePromptContext,
  categories: Array<{ name: string; slug: string }>
): string {
  const deckCards = context.cards.filter(c => !c.isSideboard)

  const categoryList = categories.map(c => `- ${c.name} (slug: "${c.slug}")`).join('\n')

  const cardList = deckCards
    .map(c => {
      const parts = [`${c.name} (${c.typeLine})`]
      if (c.oracleText) parts.push(`— ${c.oracleText}`)
      return parts.join(' ')
    })
    .join('\n')

  const manualSection = context.manualOverrides?.length
    ? `\n\n## Manual Overrides (DO NOT CHANGE)\nThese assignments were set by the user and MUST be preserved:\n${context.manualOverrides.map(o => `- ${o.cardName} → ${o.category}`).join('\n')}`
    : ''

  return `You are a Magic: The Gathering card categorizer. Assign every card in this deck to one or more functional categories.

## Available Categories
${categoryList}
- Lands (slug: "lands") — use for all land cards

## Assignment Rules
1. Every non-land card MUST be assigned to at least one category
2. All lands MUST get "lands" as their primary category slug. Lands with relevant activated abilities (e.g., channel abilities, removal effects) should ALSO be assigned to relevant functional categories
3. A card CAN belong to multiple categories (e.g., Cyclonic Rift belongs to both "targeted-removal" and "board-wipes")
4. Use category slugs (not names) in your response
5. Cards that truly serve no functional role go in "unassignable" — this should almost always be empty
${manualSection}

## Card List
${cardList}

Respond with valid JSON:
{
  "assignments": [{ "cardName": "Sol Ring", "categories": ["ramp"] }],
  "landAssignments": [{ "cardName": "Bojuka Bog", "categories": ["lands", "targeted-removal"] }],
  "unassignable": []
}`
}
