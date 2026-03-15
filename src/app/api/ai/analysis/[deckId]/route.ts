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

    const rows = await db
      .select({
        id: deckAnalyses.id,
        createdAt: deckAnalyses.createdAt,
        results: deckAnalyses.results,
      })
      .from(deckAnalyses)
      .where(
        and(
          eq(deckAnalyses.deckId, deckId),
          eq(deckAnalyses.status, 'complete'),
          eq(deckAnalyses.analysisType, 'full')
        )
      )
      .orderBy(desc(deckAnalyses.createdAt))

    if (rows.length === 0) {
      return NextResponse.json({ latest: null, history: [] })
    }

    const latest = rows[0].results

    const history = rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      bracket:
        row.results != null &&
        typeof row.results === 'object' &&
        !Array.isArray(row.results)
          ? (row.results as Record<string, unknown>).bracket ?? null
          : null,
    }))

    return NextResponse.json({ latest, history })
  } catch (error) {
    console.error('[Analysis GET] error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch analysis' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
