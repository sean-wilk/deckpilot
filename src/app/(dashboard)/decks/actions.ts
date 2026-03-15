'use server'

import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { decks, deckCards, deckVersions, cards } from '@/lib/db/schema'
import { eq, and, max } from 'drizzle-orm'
import { deriveCardType } from '@/lib/utils/card-type'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  return user
}

export async function createDeck(formData: FormData) {
  const user = await requireUser()

  const name = formData.get('name') as string
  const commanderId = formData.get('commanderId') as string
  const partnerId = formData.get('partnerId') as string | null
  const targetBracket = Number(formData.get('targetBracket') ?? 2)
  const budgetLimitCents = formData.get('budgetLimitCents') ? Number(formData.get('budgetLimitCents')) : null

  const [deck] = await db.insert(decks).values({
    ownerId: user.id,
    name,
    commanderId,
    partnerId: partnerId || null,
    targetBracket,
    budgetLimitCents,
  }).returning()

  // Create initial version
  await db.insert(deckVersions).values({
    deckId: deck.id,
    versionNumber: 1,
    snapshot: { cards: [], settings: { name, targetBracket } },
    changeSummary: 'Deck created',
  })

  return { id: deck.id }
}

export async function updateDeck(deckId: string, formData: FormData) {
  const user = await requireUser()

  const name = formData.get('name') as string
  const description = formData.get('description') as string | null
  const targetBracket = Number(formData.get('targetBracket'))
  const budgetLimitCents = formData.get('budgetLimitCents') ? Number(formData.get('budgetLimitCents')) : null

  await db.update(decks)
    .set({ name, description, targetBracket, budgetLimitCents, updatedAt: new Date() })
    .where(and(eq(decks.id, deckId), eq(decks.ownerId, user.id)))

  revalidatePath(`/decks/${deckId}`)
}

export async function deleteDeck(deckId: string) {
  const user = await requireUser()

  await db.delete(decks)
    .where(and(eq(decks.id, deckId), eq(decks.ownerId, user.id)))

  redirect('/decks')
}

export async function addCardToDeck(deckId: string, cardId: string) {
  const user = await requireUser()

  // Verify deck ownership
  const deck = await db.select().from(decks)
    .where(and(eq(decks.id, deckId), eq(decks.ownerId, user.id)))
    .limit(1)
  if (!deck[0]) throw new Error('Deck not found')

  // Get card data for type derivation
  const card = await db.select().from(cards).where(eq(cards.id, cardId)).limit(1)
  if (!card[0]) throw new Error('Card not found')

  // Color identity validation
  const isLand = card[0].typeLine.toLowerCase().startsWith('land') || card[0].typeLine.toLowerCase().startsWith('basic land')
  const isColorless = card[0].colorIdentity.length === 0
  if (!isLand && !isColorless && deck[0].commanderId) {
    const commanderCard = await db.select().from(cards).where(eq(cards.id, deck[0].commanderId)).limit(1)
    if (commanderCard[0]) {
      const commanderColorIdentity = commanderCard[0].colorIdentity
      const isValid = card[0].colorIdentity.every(c => commanderColorIdentity.includes(c))
      if (!isValid) {
        return { error: "Card's color identity does not match commander's color identity" }
      }
    }
  }

  // Get next sort order
  const maxOrder = await db.select({ max: max(deckCards.sortOrder) })
    .from(deckCards)
    .where(eq(deckCards.deckId, deckId))
  const nextOrder = (maxOrder[0]?.max ?? 0) + 1

  await db.insert(deckCards).values({
    deckId,
    cardId,
    cardType: deriveCardType(card[0].typeLine),
    sortOrder: nextOrder,
  }).onConflictDoNothing()

  await db.update(decks).set({ updatedAt: new Date() }).where(eq(decks.id, deckId))

  revalidatePath(`/decks/${deckId}`)
}

export async function removeCardFromDeck(deckId: string, deckCardId: string) {
  const user = await requireUser()

  // Verify deck ownership
  const deck = await db.select().from(decks)
    .where(and(eq(decks.id, deckId), eq(decks.ownerId, user.id)))
    .limit(1)
  if (!deck[0]) throw new Error('Deck not found')

  await db.delete(deckCards).where(eq(deckCards.id, deckCardId))
  await db.update(decks).set({ updatedAt: new Date() }).where(eq(decks.id, deckId))

  revalidatePath(`/decks/${deckId}`)
}

export async function updatePreferredPrinting(deckCardId: string, imageUris: Record<string, string>) {
  await requireUser()
  await db.update(deckCards)
    .set({ preferredImageUris: imageUris })
    .where(eq(deckCards.id, deckCardId))
  // No revalidation needed — client updates optimistically
}

export async function createDeckSnapshot(deckId: string, changeSummary: string) {
  const user = await requireUser()

  const deck = await db.select().from(decks)
    .where(and(eq(decks.id, deckId), eq(decks.ownerId, user.id)))
    .limit(1)
  if (!deck[0]) throw new Error('Deck not found')

  const currentCards = await db.select().from(deckCards).where(eq(deckCards.deckId, deckId))

  const maxVersion = await db.select({ max: max(deckVersions.versionNumber) })
    .from(deckVersions)
    .where(eq(deckVersions.deckId, deckId))

  const nextVersion = (maxVersion[0]?.max ?? 0) + 1

  await db.insert(deckVersions).values({
    deckId,
    versionNumber: nextVersion,
    snapshot: { cards: currentCards, settings: { name: deck[0].name, targetBracket: deck[0].targetBracket } },
    changeSummary,
  })
}
