import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { deckAnalyses, decks } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { inngest } from '@/lib/inngest/client'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const { deckId, focus, wildcardMode } = await request.json()

    const deck = await db.select().from(decks)
      .where(and(eq(decks.id, deckId), eq(decks.ownerId, user.id)))
      .limit(1)
    if (!deck[0]) return new Response('Deck not found', { status: 404 })

    const [analysis] = await db.insert(deckAnalyses).values({
      deckId,
      analysisType: 'swap_suggestion',
      aiProvider: 'configured',
      aiModel: 'configured',
      promptTokens: 0,
      completionTokens: 0,
      costCents: 0,
      results: {},
      status: 'pending',
    }).returning()

    await inngest.send({ name: 'ai/recommendations.requested', data: { deckId, analysisId: analysis.id, focus, wildcardMode } })

    return NextResponse.json({ analysisId: analysis.id, status: 'pending' })
  } catch (error) {
    console.error('Recommendations error:', error)
    return new Response(JSON.stringify({ error: 'Recommendations failed' }), { status: 500 })
  }
}
