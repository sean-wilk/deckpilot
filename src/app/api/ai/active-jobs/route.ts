import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { deckAnalyses, decks } from '@/lib/db/schema'
import { eq, and, or, sql } from 'drizzle-orm'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    // Active jobs: pending or processing
    const activeRows = await db
      .select({
        deckId: deckAnalyses.deckId,
        deckName: decks.name,
        analysisType: deckAnalyses.analysisType,
        status: deckAnalyses.status,
        results: deckAnalyses.results,
      })
      .from(deckAnalyses)
      .innerJoin(decks, eq(deckAnalyses.deckId, decks.id))
      .where(
        and(
          eq(decks.ownerId, user.id),
          or(
            eq(deckAnalyses.status, 'pending'),
            eq(deckAnalyses.status, 'processing')
          )
        )
      )

    const jobs = activeRows.map((row) => {
      const rawResults = row.results as Record<string, unknown> | null
      const progress = (rawResults?._progress as Record<string, unknown>) ?? null
      return {
        deckId: row.deckId,
        deckName: row.deckName,
        analysisType: row.analysisType,
        status: row.status,
        progress,
      }
    })

    // Recently completed jobs (within last 30 seconds) for toast notifications
    const recentlyCompleted = await db
      .select({
        deckId: deckAnalyses.deckId,
        deckName: decks.name,
        analysisType: deckAnalyses.analysisType,
        status: deckAnalyses.status,
        errorMessage: deckAnalyses.errorMessage,
      })
      .from(deckAnalyses)
      .innerJoin(decks, eq(deckAnalyses.deckId, decks.id))
      .where(
        and(
          eq(decks.ownerId, user.id),
          or(
            eq(deckAnalyses.status, 'complete'),
            eq(deckAnalyses.status, 'failed')
          ),
          sql`(${deckAnalyses.results}->>'_completedAt')::timestamptz > NOW() - INTERVAL '30 seconds'`
        )
      )

    const completions = recentlyCompleted.map((row) => ({
      deckId: row.deckId,
      deckName: row.deckName,
      analysisType: row.analysisType,
      finalStatus: row.status as 'complete' | 'failed',
      errorMessage: row.errorMessage,
    }))

    return NextResponse.json({ jobs, recentlyCompleted: completions })
  } catch (error) {
    console.error('Active jobs error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch active jobs' }), { status: 500 })
  }
}
