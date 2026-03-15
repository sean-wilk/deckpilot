import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { deckAnalyses, swapRecommendations, cards } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const { deckId } = await params

    // Find the latest completed swap_suggestion analysis for this deck
    const analyses = await db
      .select({
        id: deckAnalyses.id,
        results: deckAnalyses.results,
        createdAt: deckAnalyses.createdAt,
      })
      .from(deckAnalyses)
      .where(
        and(
          eq(deckAnalyses.deckId, deckId),
          eq(deckAnalyses.status, 'complete'),
          eq(deckAnalyses.analysisType, 'swap_suggestion')
        )
      )
      .orderBy(desc(deckAnalyses.createdAt))
      .limit(1)

    if (analyses.length === 0) {
      return NextResponse.json(null)
    }

    const analysis = analyses[0]

    // Alias cards table twice for cardOut and cardIn joins
    const cardOut = alias(cards, 'card_out')
    const cardIn = alias(cards, 'card_in')

    const recs = await db
      .select({
        id: swapRecommendations.id,
        tier: swapRecommendations.tier,
        cardOutName: cardOut.name,
        cardOutImageUri: cardOut.imageUris,
        cardInName: cardIn.name,
        cardInImageUri: cardIn.imageUris,
        reasoning: swapRecommendations.reasoning,
        impactSummary: swapRecommendations.impactSummary,
        tags: swapRecommendations.tags,
        accepted: swapRecommendations.accepted,
        sortOrder: swapRecommendations.sortOrder,
      })
      .from(swapRecommendations)
      .leftJoin(cardOut, eq(swapRecommendations.cardOutId, cardOut.id))
      .leftJoin(cardIn, eq(swapRecommendations.cardInId, cardIn.id))
      .where(eq(swapRecommendations.analysisId, analysis.id))
      .orderBy(swapRecommendations.sortOrder)

    const results = analysis.results as Record<string, unknown> | null

    return NextResponse.json({
      analysisId: analysis.id,
      recommendations: recs.map((r) => ({
        id: r.id,
        tier: r.tier,
        cardOutName: r.cardOutName,
        cardOutImageUri: r.cardOutImageUri,
        cardInName: r.cardInName,
        cardInImageUri: r.cardInImageUri,
        reasoning: r.reasoning,
        impactSummary: r.impactSummary,
        tags: r.tags,
        accepted: r.accepted,
        sortOrder: r.sortOrder,
      })),
      summary: results != null && typeof results === 'object' ? (results.summary ?? null) : null,
      estimatedBracketAfter:
        results != null && typeof results === 'object'
          ? (results.estimatedBracketAfter ?? null)
          : null,
      createdAt: analysis.createdAt,
    })
  } catch (error) {
    console.error('[Recommendations GET] error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch recommendations' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
