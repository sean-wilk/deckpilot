import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { deckCards, decks, deckCardCategories } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const { deckId } = await params

    const body = await request.json()
    const { deckCardId, categories, action } = body as {
      deckCardId: string
      categories: string[]
      action: 'set' | 'add' | 'remove'
    }

    if (
      !deckCardId ||
      !Array.isArray(categories) ||
      !['set', 'add', 'remove'].includes(action) ||
      (action !== 'set' && categories.length === 0)
    ) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

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

    if (action === 'set') {
      // Delete all existing categories for this deckCard, then insert the new set
      await db
        .delete(deckCardCategories)
        .where(eq(deckCardCategories.deckCardId, deckCardId))

      if (categories.length > 0) {
        await db.insert(deckCardCategories).values(
          categories.map((category) => ({
            deckCardId,
            category,
            isManualOverride: true,
            source: 'manual',
          }))
        )
      }
    } else if (action === 'add') {
      if (categories.length > 0) {
        await db
          .insert(deckCardCategories)
          .values(
            categories.map((category) => ({
              deckCardId,
              category,
              isManualOverride: true,
              source: 'manual',
            }))
          )
          .onConflictDoNothing()
      }
    } else if (action === 'remove') {
      if (categories.length > 0) {
        await db
          .delete(deckCardCategories)
          .where(
            and(
              eq(deckCardCategories.deckCardId, deckCardId),
              inArray(deckCardCategories.category, categories)
            )
          )
      }
    }

    // Return the updated categories for this card
    const updated = await db
      .select({
        category: deckCardCategories.category,
        isManualOverride: deckCardCategories.isManualOverride,
        source: deckCardCategories.source,
      })
      .from(deckCardCategories)
      .where(eq(deckCardCategories.deckCardId, deckCardId))

    return NextResponse.json({ categories: updated })
  } catch (error) {
    console.error('Card category update error:', error)
    return NextResponse.json({ error: 'Failed to update categories' }, { status: 500 })
  }
}
