import { db } from '@/lib/db'
import { cards } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'

export interface CardValidationResult {
  valid: boolean
  cardId: string | null
  cardName: string
  reason?: 'not_found' | 'color_violation' | 'duplicate'
  dbCard?: {
    id: string
    name: string
    typeLine: string
    colorIdentity: string[]
  }
}

// Single card validation (for Fast Mode inline use)
export async function validateCard(
  cardName: string,
  commanderColorIdentity: string[],
  seenCardIds: Set<string>
): Promise<CardValidationResult> {
  // Case-insensitive DB lookup
  const rows = await db
    .select({
      id: cards.id,
      name: cards.name,
      typeLine: cards.typeLine,
      colorIdentity: cards.colorIdentity,
    })
    .from(cards)
    .where(sql`LOWER(${cards.name}) = LOWER(${cardName})`)
    .limit(1)

  if (rows.length === 0) {
    return { valid: false, cardId: null, cardName, reason: 'not_found' }
  }

  const dbCard = rows[0]

  // Duplicate check (basic lands exempt)
  const isBasicLand = dbCard.typeLine.toLowerCase().includes('basic land')
  if (seenCardIds.has(dbCard.id) && !isBasicLand) {
    return { valid: false, cardId: dbCard.id, cardName, reason: 'duplicate', dbCard }
  }

  // Color identity check (colorless exempt)
  const isColorless = !dbCard.colorIdentity || dbCard.colorIdentity.length === 0
  if (!isColorless) {
    const violates = dbCard.colorIdentity.some(c => !commanderColorIdentity.includes(c))
    if (violates) {
      return { valid: false, cardId: dbCard.id, cardName, reason: 'color_violation', dbCard }
    }
  }

  return { valid: true, cardId: dbCard.id, cardName, dbCard }
}

// Batch validation (for Quality Mode)
export async function validateCardBatch(
  cardNames: string[],
  commanderColorIdentity: string[],
  existingCardIds?: Set<string>  // NEW: pre-populated with already-accepted card IDs
): Promise<Map<string, CardValidationResult>> {
  const results = new Map<string, CardValidationResult>()
  const seenCardIds = new Set<string>(existingCardIds ?? [])

  // Batch DB lookup
  const lowerNames = cardNames.map(n => n.toLowerCase())
  const dbCards = await db
    .select({
      id: cards.id,
      name: cards.name,
      typeLine: cards.typeLine,
      colorIdentity: cards.colorIdentity,
    })
    .from(cards)
    .where(
      sql`LOWER(${cards.name}) IN (${sql.join(lowerNames.map(n => sql`${n}`), sql`, `)})`
    )

  const dbCardMap = new Map(dbCards.map(c => [c.name.toLowerCase(), c]))

  for (const name of cardNames) {
    const dbCard = dbCardMap.get(name.toLowerCase())

    if (!dbCard) {
      results.set(name, { valid: false, cardId: null, cardName: name, reason: 'not_found' })
      continue
    }

    const isBasicLand = dbCard.typeLine.toLowerCase().includes('basic land')
    if (seenCardIds.has(dbCard.id) && !isBasicLand) {
      results.set(name, { valid: false, cardId: dbCard.id, cardName: name, reason: 'duplicate', dbCard })
      continue
    }
    if (!isBasicLand) seenCardIds.add(dbCard.id)

    const isColorless = !dbCard.colorIdentity || dbCard.colorIdentity.length === 0
    if (!isColorless) {
      const violates = dbCard.colorIdentity.some(c => !commanderColorIdentity.includes(c))
      if (violates) {
        results.set(name, { valid: false, cardId: dbCard.id, cardName: name, reason: 'color_violation', dbCard })
        continue
      }
    }

    results.set(name, { valid: true, cardId: dbCard.id, cardName: name, dbCard })
  }

  return results
}
