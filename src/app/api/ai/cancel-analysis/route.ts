import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { deckAnalyses, decks } from '@/lib/db/schema'
import { eq, and, or } from 'drizzle-orm'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const { deckId, analysisType } = await request.json()

    // Verify deck ownership
    const deck = await db.select({ id: decks.id }).from(decks)
      .where(and(eq(decks.id, deckId), eq(decks.ownerId, user.id)))
      .limit(1)
    if (deck.length === 0) return new Response('Deck not found', { status: 404 })

    // Cancel all pending/processing analyses for this deck and type
    await db.update(deckAnalyses)
      .set({ status: 'failed', errorMessage: 'Cancelled by user' })
      .where(
        and(
          eq(deckAnalyses.deckId, deckId),
          ...(analysisType ? [eq(deckAnalyses.analysisType, analysisType)] : []),
          or(
            eq(deckAnalyses.status, 'pending'),
            eq(deckAnalyses.status, 'processing')
          )
        )
      )

    return NextResponse.json({ cancelled: true })
  } catch (error) {
    console.error('Cancel analysis error:', error)
    return new Response(JSON.stringify({ error: 'Cancel failed' }), { status: 500 })
  }
}
