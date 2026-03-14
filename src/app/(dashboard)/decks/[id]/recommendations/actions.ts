'use server'

import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { deckCards, cards, decks } from '@/lib/db/schema'
import { eq, and, max } from 'drizzle-orm'
import { deriveCardType } from '@/lib/utils/card-type'
import { revalidatePath } from 'next/cache'

export async function acceptRecommendation(
  deckId: string,
  analysisId: string,
  cardOutName: string | null,
  cardInName: string | null
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const deck = await db.select().from(decks)
    .where(and(eq(decks.id, deckId), eq(decks.ownerId, user.id)))
    .limit(1)
  if (!deck[0]) throw new Error('Deck not found')

  // Remove card out
  if (cardOutName) {
    const cardOut = await db.select().from(cards).where(eq(cards.name, cardOutName)).limit(1)
    if (cardOut[0]) {
      await db.delete(deckCards)
        .where(and(eq(deckCards.deckId, deckId), eq(deckCards.cardId, cardOut[0].id)))
    }
  }

  // Add card in
  if (cardInName) {
    const cardIn = await db.select().from(cards).where(eq(cards.name, cardInName)).limit(1)
    if (cardIn[0]) {
      const maxOrder = await db.select({ max: max(deckCards.sortOrder) })
        .from(deckCards).where(eq(deckCards.deckId, deckId))

      await db.insert(deckCards).values({
        deckId,
        cardId: cardIn[0].id,
        cardType: deriveCardType(cardIn[0].typeLine),
        sortOrder: (maxOrder[0]?.max ?? 0) + 1,
      }).onConflictDoNothing()
    }
  }

  revalidatePath(`/decks/${deckId}`)
}
