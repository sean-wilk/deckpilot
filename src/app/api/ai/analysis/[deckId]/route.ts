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
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const { deckId } = await params

    const deckRows = await db.select({ id: decks.id }).from(decks)
      .where(and(eq(decks.id, deckId), eq(decks.ownerId, user.id)))
      .limit(1)
    if (deckRows.length === 0) {
      return new Response('Deck not found', { status: 404 })
    }

    // Fetch the most recent record regardless of status (for polling support)
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
          eq(deckAnalyses.analysisType, 'full')
        )
      )
      .orderBy(desc(deckAnalyses.createdAt))

    if (allRows.length === 0) {
      return NextResponse.json({ results: null, status: null, history: [], errorMessage: null })
    }

    const mostRecent = allRows[0]
    const currentStatus = mostRecent.status as 'pending' | 'processing' | 'complete' | 'failed'

    // Build the results payload based on status
    const rawResults = mostRecent.results as Record<string, unknown> | null
    let results: unknown
    let progress: Record<string, unknown> | null = null
    let isPartial = false

    if (currentStatus === 'complete') {
      // Strip internal markers from final results
      if (rawResults) {
        results = stripInternalFields(rawResults)
      } else {
        results = rawResults
      }
    } else if (currentStatus === 'processing' || currentStatus === 'pending') {
      // Extract progress info
      progress = (rawResults?._progress as Record<string, unknown>) ?? null

      // Check for partial results (headline fields available after step 4)
      if (rawResults?._partial === true) {
        results = stripInternalFields(rawResults)
        isPartial = true
      } else {
        results = null
      }
    } else {
      results = null
    }

    // Only include full history when the current analysis is complete
    // During polling (pending/processing), return lightweight metadata only
    const completeRows = allRows.filter((row) => row.status === 'complete')
    const history = completeRows.map((row) => {
      const bracket =
        row.results != null &&
        typeof row.results === 'object' &&
        !Array.isArray(row.results)
          ? (row.results as Record<string, unknown>).bracket ?? null
          : null

      if (currentStatus === 'complete') {
        return { id: row.id, createdAt: row.createdAt, results: row.results, bracket }
      }
      // Lightweight: just id, date, and bracket for polling responses
      return { id: row.id, createdAt: row.createdAt, results: null, bracket }
    })

    const response: Record<string, unknown> = {
      results,
      status: currentStatus,
      history,
      errorMessage: currentStatus === 'failed' ? (mostRecent.errorMessage ?? null) : null,
      progress,
      isPartial,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[Analysis GET] error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch analysis' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
