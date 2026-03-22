import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { deckAnalyses, decks } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { stripInternalFields } from '@/lib/ai/utils'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const { deckId } = await params

    // Verify deck ownership
    const deckRows = await db.select({ id: decks.id }).from(decks)
      .where(and(eq(decks.id, deckId), eq(decks.ownerId, user.id)))
      .limit(1)
    if (deckRows.length === 0) return new Response('Deck not found', { status: 404 })

    const allRows = await db
      .select({
        id: deckAnalyses.id,
        createdAt: deckAnalyses.createdAt,
        status: deckAnalyses.status,
        results: deckAnalyses.results,
        errorMessage: deckAnalyses.errorMessage,
      })
      .from(deckAnalyses)
      .where(
        and(
          eq(deckAnalyses.deckId, deckId),
          eq(deckAnalyses.analysisType, 'mana_fixing')
        )
      )
      .orderBy(desc(deckAnalyses.createdAt))

    if (allRows.length === 0) {
      return NextResponse.json({ results: null, status: null, progress: null, isPartial: false, errorMessage: null, history: [] })
    }

    const mostRecent = allRows[0]
    const currentStatus = mostRecent.status as 'pending' | 'processing' | 'complete' | 'failed'
    const rawResults = mostRecent.results as Record<string, unknown> | null

    let results: unknown
    let progress: Record<string, unknown> | null = null
    let isPartial = false

    if (currentStatus === 'complete') {
      results = rawResults ? stripInternalFields(rawResults) : rawResults
    } else if (currentStatus === 'processing' || currentStatus === 'pending') {
      progress = (rawResults?._progress as Record<string, unknown>) ?? null
      if (rawResults?._partial === true) {
        results = stripInternalFields(rawResults)
        isPartial = true
      } else {
        results = null
      }
    } else {
      results = null
    }

    const completeRows = allRows.filter((row) => row.status === 'complete')
    const history = completeRows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
    }))

    return NextResponse.json({
      results,
      status: currentStatus,
      history,
      errorMessage: currentStatus === 'failed' ? (mostRecent.errorMessage ?? null) : null,
      progress,
      isPartial,
    })
  } catch (error) {
    console.error('[Mana Fixing GET] error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch mana fixing analysis' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
