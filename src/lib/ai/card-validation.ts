import { db } from '@/lib/db'
import { cards } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'

export interface CardValidationResult {
  valid: boolean
  cardId: string | null
  cardName: string
  correctedName?: string
  reason?: 'not_found' | 'color_violation' | 'duplicate'
  dbCard?: {
    id: string
    name: string
    typeLine: string
    colorIdentity: string[]
  }
}

/**
 * Fuzzy match a card name against the database using pg_trgm.
 * Falls back through increasingly loose matching strategies.
 */
async function fuzzyMatchCardName(
  cardName: string
): Promise<{ id: string; name: string; typeLine: string; colorIdentity: string[] } | null> {
  // Strategy 1: Trigram similarity (requires pg_trgm extension)
  try {
    const trigramResults = await db
      .select({
        id: cards.id,
        name: cards.name,
        typeLine: cards.typeLine,
        colorIdentity: cards.colorIdentity,
      })
      .from(cards)
      .where(sql`similarity(${cards.name}, ${cardName}) > 0.3`)
      .orderBy(sql`similarity(${cards.name}, ${cardName}) DESC`)
      .limit(1)

    if (trigramResults.length > 0) {
      console.log(`[fuzzy] Trigram matched "${cardName}" -> "${trigramResults[0].name}"`)
      return trigramResults[0]
    }
  } catch (err) {
    // pg_trgm may not be enabled yet, fall through to other strategies
    console.warn('[fuzzy] Trigram search failed, falling back:', err instanceof Error ? err.message : err)
  }

  // Escape LIKE metacharacters
  const escapedName = cardName.replace(/%/g, '\\%').replace(/_/g, '\\_')

  // Strategy 2: Starts with
  const startsWithResults = await db
    .select({
      id: cards.id,
      name: cards.name,
      typeLine: cards.typeLine,
      colorIdentity: cards.colorIdentity,
    })
    .from(cards)
    .where(sql`LOWER(${cards.name}) LIKE LOWER(${escapedName}) || '%'`)
    .limit(1)

  if (startsWithResults.length > 0) {
    console.log(`[fuzzy] Starts-with matched "${cardName}" -> "${startsWithResults[0].name}"`)
    return startsWithResults[0]
  }

  // Strategy 3: Contains
  const containsResults = await db
    .select({
      id: cards.id,
      name: cards.name,
      typeLine: cards.typeLine,
      colorIdentity: cards.colorIdentity,
    })
    .from(cards)
    .where(sql`LOWER(${cards.name}) LIKE '%' || LOWER(${escapedName}) || '%'`)
    .limit(1)

  if (containsResults.length > 0) {
    console.log(`[fuzzy] Contains matched "${cardName}" -> "${containsResults[0].name}"`)
    return containsResults[0]
  }

  return null
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
    // Try fuzzy matching
    const fuzzyResult = await fuzzyMatchCardName(cardName)
    if (!fuzzyResult) {
      return { valid: false, cardId: null, cardName, reason: 'not_found' }
    }
    // Use fuzzy-matched card, but still run duplicate + color checks
    const dbCard = fuzzyResult
    const isBasicLand = dbCard.typeLine.toLowerCase().includes('basic land')
    if (seenCardIds.has(dbCard.id) && !isBasicLand) {
      return { valid: false, cardId: dbCard.id, cardName, reason: 'duplicate', dbCard }
    }
    const isColorless = !dbCard.colorIdentity || dbCard.colorIdentity.length === 0
    if (!isColorless) {
      const violates = dbCard.colorIdentity.some(c => !commanderColorIdentity.includes(c))
      if (violates) {
        return { valid: false, cardId: dbCard.id, cardName, reason: 'color_violation', dbCard }
      }
    }
    return { valid: true, cardId: dbCard.id, cardName, correctedName: dbCard.name, dbCard }
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
  if (cardNames.length === 0) return results

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

  // Fuzzy match any names not found by exact match
  const missingNames = cardNames.filter(n => !dbCardMap.has(n.toLowerCase()))
  for (const name of missingNames) {
    const fuzzyResult = await fuzzyMatchCardName(name)
    if (fuzzyResult) {
      dbCardMap.set(name.toLowerCase(), fuzzyResult)
    }
  }

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

    // Check if this was a fuzzy match (name differs from DB name)
    const wasFuzzyMatched = dbCard.name.toLowerCase() !== name.toLowerCase()
    results.set(name, {
      valid: true,
      cardId: dbCard.id,
      cardName: name,
      correctedName: wasFuzzyMatched ? dbCard.name : undefined,
      dbCard,
    })
  }

  return results
}
