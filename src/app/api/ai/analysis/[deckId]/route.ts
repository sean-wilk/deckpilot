import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { deckAnalyses } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'

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
    let results: unknown
    if (currentStatus === 'complete') {
      results = mostRecent.results
    } else {
      results = null
    }

    // History includes complete records with full results for client-side switching
    const completeRows = allRows.filter((row) => row.status === 'complete')
    const history = completeRows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      results: row.results,
      bracket:
        row.results != null &&
        typeof row.results === 'object' &&
        !Array.isArray(row.results)
          ? (row.results as Record<string, unknown>).bracket ?? null
          : null,
    }))

    const response: Record<string, unknown> = {
      results,
      status: currentStatus,
      history,
      errorMessage: currentStatus === 'failed' ? (mostRecent.errorMessage ?? null) : null,
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
