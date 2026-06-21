import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { deckStructureAnalyses, decks } from '@/lib/db/schema'
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
    await db
      .delete(deckStructureAnalyses)
      .where(
        and(
          eq(deckStructureAnalyses.deckId, deckId),
          or(
            eq(deckStructureAnalyses.status, 'pending'),
            eq(deckStructureAnalyses.status, 'processing')
          ),
          lt(deckStructureAnalyses.createdAt, staleThreshold)
        )
      )

    // Create structure analysis record
    const [structureAnalysis] = await db
      .insert(deckStructureAnalyses)
      .values({
        deckId,
        status: 'pending',
      })
      .returning()

    await inngest.send({
      name: 'ai/structure.requested',
      data: { deckId, structureAnalysisId: structureAnalysis.id },
    })

    return NextResponse.json({ structureAnalysisId: structureAnalysis.id, status: 'pending' })
  } catch (error) {
    console.error('Structure analysis error:', error)
    return new Response(
      JSON.stringify({ error: 'Structure analysis failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
