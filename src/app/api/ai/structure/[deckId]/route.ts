import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { deckStructureAnalyses } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getCardCategoriesForDeck, buildCardRolesMap } from '@/lib/queries/card-categories'

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

    // Fetch the most recent structure analysis record
    const rows = await db
      .select({
        id: deckStructureAnalyses.id,
        status: deckStructureAnalyses.status,
        results: deckStructureAnalyses.results,
        errorMessage: deckStructureAnalyses.errorMessage,
        createdAt: deckStructureAnalyses.createdAt,
      })
      .from(deckStructureAnalyses)
      .where(eq(deckStructureAnalyses.deckId, deckId))
      .orderBy(desc(deckStructureAnalyses.createdAt))
      .limit(1)

    // Fetch card categories and build roles map
    const categories = await getCardCategoriesForDeck(deckId)
    const cardRoles = buildCardRolesMap(categories)

    if (rows.length === 0) {
      return NextResponse.json({ analysis: null, cardRoles })
    }

    const row = rows[0]
    return NextResponse.json({
      analysis: {
        id: row.id,
        status: row.status,
        results: row.results,
        errorMessage: row.errorMessage,
        createdAt: row.createdAt,
      },
      cardRoles,
    })
  } catch (error) {
    console.error('[Structure GET] error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch structure analysis' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
