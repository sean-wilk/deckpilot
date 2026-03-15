import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { swapRecommendations, deckAnalyses, deckCards, cards, decks } from '@/lib/db/schema'
import { eq, and, max } from 'drizzle-orm'
import { deriveCardType } from '@/lib/utils/card-type'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const { deckId } = await params

    // Verify deck ownership
    const deck = await db.select().from(decks)
      .where(and(eq(decks.id, deckId), eq(decks.ownerId, user.id)))
      .limit(1)
    if (!deck[0]) return new Response('Deck not found', { status: 404 })

    const { recommendationId, status } = await request.json() as {
      recommendationId: string
      status: 'accepted' | 'skipped' | 'dismissed'
    }

    if (!recommendationId || !['accepted', 'skipped', 'dismissed'].includes(status)) {
      return new Response('Invalid request body', { status: 400 })
    }

    // Map status to accepted boolean
    const acceptedValue = status === 'accepted' ? true : status === 'skipped' ? false : null

    // Fetch the recommendation first (to get cardOutId / cardInId if accepting)
    const [rec] = await db.select().from(swapRecommendations)
      .where(eq(swapRecommendations.id, recommendationId))
      .limit(1)
    if (!rec) return new Response('Recommendation not found', { status: 404 })

    // Verify the recommendation belongs to a deck analysis for this deck
    const [analysis] = await db.select().from(deckAnalyses)
      .where(and(eq(deckAnalyses.id, rec.analysisId), eq(deckAnalyses.deckId, deckId)))
      .limit(1)
    if (!analysis) return new Response('Recommendation not found', { status: 404 })

    // If accepting, perform the swap
    if (status === 'accepted') {
      // Remove card out
      if (rec.cardOutId) {
        await db.delete(deckCards)
          .where(and(eq(deckCards.deckId, deckId), eq(deckCards.cardId, rec.cardOutId)))
      }

      // Add card in
      if (rec.cardInId) {
        const [cardIn] = await db.select().from(cards).where(eq(cards.id, rec.cardInId)).limit(1)
        if (cardIn) {
          const maxOrder = await db.select({ max: max(deckCards.sortOrder) })
            .from(deckCards).where(eq(deckCards.deckId, deckId))

          await db.insert(deckCards).values({
            deckId,
            cardId: cardIn.id,
            cardType: deriveCardType(cardIn.typeLine),
            sortOrder: (maxOrder[0]?.max ?? 0) + 1,
          }).onConflictDoNothing()
        }
      }
    }

    // Update the recommendation status
    const [updated] = await db.update(swapRecommendations)
      .set({ accepted: acceptedValue })
      .where(eq(swapRecommendations.id, recommendationId))
      .returning()

    return Response.json(updated)
  } catch (error) {
    console.error('Status update error:', error)
    return new Response(JSON.stringify({ error: 'Status update failed' }), { status: 500 })
  }
}
