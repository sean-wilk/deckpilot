import { db } from '@/lib/db'
import { deckCardCategories, deckCards, cards } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'

type CategoryRow = { cardName: string; category: string }
type CategoryRowWithOverride = CategoryRow & { isManualOverride: boolean }
type Assignment = { cardName: string; categories: string[] }

/** Build a cardName → roles[] map from category rows */
export function buildCardRolesMap(
  rows: CategoryRow[]
): Record<string, string[]> {
  const map: Record<string, string[]> = {}
  for (const row of rows) {
    if (!map[row.cardName]) map[row.cardName] = []
    if (!map[row.cardName].includes(row.category)) {
      map[row.cardName].push(row.category)
    }
  }
  return map
}

/** Separate manual overrides from AI assignments for merge logic */
export function mergeWithManualOverrides(
  existing: CategoryRowWithOverride[],
  newAssignments: Assignment[]
) {
  const manualOverrides = existing.filter((r) => r.isManualOverride)
  const manualSet = new Set(
    manualOverrides.map((r) => `${r.cardName}::${r.category}`)
  )

  const preserved = manualOverrides.map((r) => ({
    cardName: r.cardName,
    category: r.category,
  }))

  const toInsert: { cardName: string; category: string; source: string }[] = []
  for (const assignment of newAssignments) {
    for (const category of assignment.categories) {
      const key = `${assignment.cardName}::${category}`
      if (!manualSet.has(key)) {
        toInsert.push({
          cardName: assignment.cardName,
          category,
          source: 'ai-structure',
        })
      }
    }
  }

  return { preserved, toInsert }
}

/** Fetch all category assignments for a deck, joined with card names */
export async function getCardCategoriesForDeck(deckId: string) {
  return db
    .select({
      deckCardId: deckCardCategories.deckCardId,
      cardName: cards.name,
      category: deckCardCategories.category,
      isManualOverride: deckCardCategories.isManualOverride,
      source: deckCardCategories.source,
    })
    .from(deckCardCategories)
    .innerJoin(deckCards, eq(deckCardCategories.deckCardId, deckCards.id))
    .innerJoin(cards, eq(deckCards.cardId, cards.id))
    .where(eq(deckCards.deckId, deckId))
}

/** Delete all non-manual-override categories for a deck */
export async function deleteAiCategories(deckId: string) {
  const deckCardIds = db
    .select({ id: deckCards.id })
    .from(deckCards)
    .where(eq(deckCards.deckId, deckId))

  await db
    .delete(deckCardCategories)
    .where(
      and(
        inArray(deckCardCategories.deckCardId, deckCardIds),
        eq(deckCardCategories.isManualOverride, false)
      )
    )
}

/** Insert category assignments in bulk */
export async function insertCardCategories(
  assignments: {
    deckCardId: string
    category: string
    isManualOverride: boolean
    source: string
  }[]
) {
  if (assignments.length === 0) return
  await db.insert(deckCardCategories).values(assignments).onConflictDoNothing()
}

/** Set a manual category override for a card */
export async function setManualCategory(
  deckCardId: string,
  category: string
) {
  await db
    .insert(deckCardCategories)
    .values({
      deckCardId,
      category,
      isManualOverride: true,
      source: 'manual',
    })
    .onConflictDoNothing()
}

/** Remove a category assignment from a card */
export async function removeCardCategory(
  deckCardId: string,
  category: string
) {
  await db
    .delete(deckCardCategories)
    .where(
      and(
        eq(deckCardCategories.deckCardId, deckCardId),
        eq(deckCardCategories.category, category)
      )
    )
}
