import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { deckAnalyses, swapRecommendations, cards } from '@/lib/db/schema'
import { eq, and, desc, ne } from 'drizzle-orm'
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

    // Find the most recent swap_suggestion analysis for this deck (any status)
    const analyses = await db
      .select({
        id: deckAnalyses.id,
        status: deckAnalyses.status,
        errorMessage: deckAnalyses.errorMessage,
        results: deckAnalyses.results,
        createdAt: deckAnalyses.createdAt,
      })
      .from(deckAnalyses)
      .where(
        and(
          eq(deckAnalyses.deckId, deckId),
          eq(deckAnalyses.analysisType, 'swap_suggestion')
        )
      )
      .orderBy(desc(deckAnalyses.createdAt))
      .limit(1)

    if (analyses.length === 0) {
      return NextResponse.json({ status: 'idle', results: null, errorMessage: null, history: [] })
    }

    const analysis = analyses[0]
    const status = analysis.status as 'pending' | 'processing' | 'complete' | 'failed'

    // Fetch history of past completed analyses (excluding current)
    const historyRows = await db
      .select({
        id: deckAnalyses.id,
        createdAt: deckAnalyses.createdAt,
      })
      .from(deckAnalyses)
      .where(
        and(
          eq(deckAnalyses.deckId, deckId),
          eq(deckAnalyses.analysisType, 'swap_suggestion'),
          eq(deckAnalyses.status, 'complete')
        )
      )
      .orderBy(desc(deckAnalyses.createdAt))

    // Exclude current analysis from history
    const history = historyRows
      .filter((r) => r.id !== analysis.id)
      .map((r) => ({ id: r.id, createdAt: r.createdAt }))

    if (status === 'pending' || status === 'processing') {
      return NextResponse.json({
        status,
        results: null,
        errorMessage: null,
        history,
      })
    }

    if (status === 'failed') {
      return NextResponse.json({
        status,
        results: null,
        errorMessage: analysis.errorMessage ?? null,
        history,
      })
    }

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
        dismissed: swapRecommendations.dismissed,
        sortOrder: swapRecommendations.sortOrder,
      })
      .from(swapRecommendations)
      .leftJoin(cardOut, eq(swapRecommendations.cardOutId, cardOut.id))
      .leftJoin(cardIn, eq(swapRecommendations.cardInId, cardIn.id))
      .where(
        and(
          eq(swapRecommendations.analysisId, analysis.id),
          ne(swapRecommendations.dismissed, true)
        )
      )
      .orderBy(swapRecommendations.sortOrder)

    const dbResults = analysis.results as Record<string, unknown> | null

    return NextResponse.json({
      status,
      results: {
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
          dismissed: r.dismissed,
          sortOrder: r.sortOrder,
        })),
        summary: dbResults != null && typeof dbResults === 'object' ? (dbResults.summary ?? null) : null,
        estimatedBracketAfter:
          dbResults != null && typeof dbResults === 'object'
            ? (dbResults.estimatedBracketAfter ?? null)
            : null,
        createdAt: analysis.createdAt,
      },
      errorMessage: null,
      history,
    })
  } catch (error) {
    console.error('[Recommendations GET] error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch recommendations' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
