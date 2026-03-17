import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { deckAnalyses } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ deckId: string; cardName: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const { deckId, cardName: encodedCardName } = await params
    const cardName = decodeURIComponent(encodedCardName)

    const [opinionRows, replacementRows] = await Promise.all([
      db
        .select({
          id: deckAnalyses.id,
          result: deckAnalyses.results,
          createdAt: deckAnalyses.createdAt,
        })
        .from(deckAnalyses)
        .where(
          and(
            eq(deckAnalyses.deckId, deckId),
            eq(deckAnalyses.cardName, cardName),
            eq(deckAnalyses.analysisType, 'card_opinion'),
            eq(deckAnalyses.status, 'complete')
          )
        )
        .orderBy(desc(deckAnalyses.createdAt))
        .limit(1),

      db
        .select({
          id: deckAnalyses.id,
          result: deckAnalyses.results,
          createdAt: deckAnalyses.createdAt,
        })
        .from(deckAnalyses)
        .where(
          and(
            eq(deckAnalyses.deckId, deckId),
            eq(deckAnalyses.cardName, cardName),
            eq(deckAnalyses.analysisType, 'card_replacement'),
            eq(deckAnalyses.status, 'complete')
          )
        )
        .orderBy(desc(deckAnalyses.createdAt))
        .limit(1),
    ])

    const opinionRow = opinionRows[0] ?? null
    const replacementRow = replacementRows[0] ?? null

    const opinion = opinionRow
      ? {
          text: (opinionRow.result as { opinion?: string })?.opinion ?? '',
          createdAt: opinionRow.createdAt,
          id: opinionRow.id,
        }
      : null

    const replacement = replacementRow
      ? {
          replacements:
            (replacementRow.result as { replacements?: unknown[] })
              ?.replacements ?? [],
          context:
            (replacementRow.result as { context?: string })?.context ?? '',
          createdAt: replacementRow.createdAt,
          id: replacementRow.id,
        }
      : null

    return new Response(JSON.stringify({ opinion, replacement }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Card results fetch error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch card results' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
