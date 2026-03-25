import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { swapRecommendations, deckAnalyses, deckCards, cards, decks } from '@/lib/db/schema'
import { eq, and, max, inArray } from 'drizzle-orm'
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

    const { recommendationIds, status, destination } = await request.json() as {
      recommendationIds: string[]
      status: 'accepted' | 'skipped'
      destination?: 'side' | 'maybe' | 'remove'
    }

    if (
      !Array.isArray(recommendationIds) ||
      recommendationIds.length === 0 ||
      !['accepted', 'skipped'].includes(status)
    ) {
      return new Response('Invalid request body', { status: 400 })
    }

    // Fetch all recommendations
    const recs = await db.select().from(swapRecommendations)
      .where(inArray(swapRecommendations.id, recommendationIds))

    if (recs.length === 0) return new Response('Recommendations not found', { status: 404 })

    // Verify all recommendations belong to analyses for this deck
    const analysisIds = [...new Set(recs.map((r) => r.analysisId))]
    const analyses = await db.select().from(deckAnalyses)
      .where(and(
        inArray(deckAnalyses.id, analysisIds),
        eq(deckAnalyses.deckId, deckId)
      ))
    const validAnalysisIds = new Set(analyses.map((a) => a.id))
    const validRecs = recs.filter((r) => validAnalysisIds.has(r.analysisId))

    if (validRecs.length === 0) return new Response('Recommendations not found', { status: 404 })

    if (status === 'skipped') {
      // Bulk skip: set accepted = false, dismissed = false
      await db.update(swapRecommendations)
        .set({ accepted: false, dismissed: false })
        .where(inArray(swapRecommendations.id, validRecs.map((r) => r.id)))
    } else {
      // Bulk accept: perform swaps for each recommendation
      for (const rec of validRecs) {
        // Handle card out based on destination
        if (rec.cardOutId) {
          const destBoard = destination === 'side' ? 'side' : destination === 'maybe' ? 'maybe' : null
          if (destBoard) {
            // Move card out to destination board
            await db.update(deckCards)
              .set({ board: destBoard, isSideboard: destBoard === 'side' })
              .where(and(eq(deckCards.deckId, deckId), eq(deckCards.cardId, rec.cardOutId)))
          } else {
            // Remove from deck
            await db.delete(deckCards)
              .where(and(eq(deckCards.deckId, deckId), eq(deckCards.cardId, rec.cardOutId)))
          }
        }

        // Add card in to mainboard
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
              board: 'main',
              isSideboard: false,
            }).onConflictDoNothing()
          }
        }
      }

      // Mark all as accepted
      await db.update(swapRecommendations)
        .set({ accepted: true, dismissed: false })
        .where(inArray(swapRecommendations.id, validRecs.map((r) => r.id)))
    }

    return Response.json({ updatedCount: validRecs.length })
  } catch (error) {
    console.error('Bulk status update error:', error)
    return new Response(JSON.stringify({ error: 'Bulk status update failed' }), { status: 500 })
  }
}
