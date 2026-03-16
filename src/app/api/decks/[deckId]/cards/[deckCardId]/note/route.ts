import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { deckCards, decks } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ deckId: string; deckCardId: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const { deckId, deckCardId } = await params

    const body = await request.json()
    const note: string = body.note ?? ''

    // Verify deck ownership and that the deckCard belongs to this deck
    const rows = await db
      .select({ deckCardId: deckCards.id })
      .from(deckCards)
      .innerJoin(decks, eq(deckCards.deckId, decks.id))
      .where(
        and(
          eq(deckCards.id, deckCardId),
          eq(decks.id, deckId),
          eq(decks.ownerId, user.id)
        )
      )
      .limit(1)

    if (!rows[0]) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await db
      .update(deckCards)
      .set({ userNote: note })
      .where(eq(deckCards.id, deckCardId))

    return NextResponse.json({ note })
  } catch (error) {
    console.error('Note save error:', error)
    return NextResponse.json({ error: 'Failed to save note' }, { status: 500 })
  }
}
