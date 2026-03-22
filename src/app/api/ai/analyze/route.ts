import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { deckAnalyses, decks } from '@/lib/db/schema'
import { eq, and, or, lt } from 'drizzle-orm'
import { inngest } from '@/lib/inngest/client'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const { deckId } = await request.json()

    // Verify deck ownership
    const deck = await db
      .select()
      .from(decks)
      .where(and(eq(decks.id, deckId), eq(decks.ownerId, user.id)))
      .limit(1)
    if (!deck[0]) return new Response('Deck not found', { status: 404 })

    // Clean up stale pending/processing records older than 10 minutes
    const staleThreshold = new Date(Date.now() - 10 * 60 * 1000)
    await db.update(deckAnalyses)
      .set({ status: 'failed', errorMessage: 'Timed out' })
      .where(
        and(
          eq(deckAnalyses.deckId, deckId),
          or(
            eq(deckAnalyses.status, 'pending'),
            eq(deckAnalyses.status, 'processing')
          ),
          lt(deckAnalyses.createdAt, staleThreshold)
        )
      )

    // Create analysis record
    const [analysis] = await db
      .insert(deckAnalyses)
      .values({
        deckId,
        analysisType: 'full',
        aiProvider: 'configured',
        aiModel: 'configured',
        promptTokens: 0,
        completionTokens: 0,
        costCents: 0,
        results: {},
        status: 'pending',
      })
      .returning()

    await inngest.send({ name: 'ai/analyze.requested', data: { deckId, analysisId: analysis.id } })

    return NextResponse.json({ analysisId: analysis.id, status: 'pending' })
  } catch (error) {
    console.error('Analysis error:', error)
    return new Response(
      JSON.stringify({ error: 'Analysis failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
