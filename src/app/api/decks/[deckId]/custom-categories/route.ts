import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { deckCards, decks, deckCardCategories } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { NextResponse } from 'next/server'

async function verifyOwnership(deckId: string, userId: string) {
  const rows = await db
    .select({ id: decks.id, customCategories: decks.customCategories })
    .from(decks)
    .where(and(eq(decks.id, deckId), eq(decks.ownerId, userId)))
    .limit(1)
  return rows[0] ?? null
}

export async function POST(
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
    const name: string = body.name?.trim()

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const deck = await verifyOwnership(deckId, user.id)
    if (!deck) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const slug = name.toLowerCase().replace(/\s+/g, '-')
    const current: string[] = deck.customCategories ?? []

    // Avoid duplicates by both exact name and computed slug
    const slugExists = current.some(n => n.toLowerCase().replace(/\s+/g, '-') === slug)
    if (current.includes(name) || slugExists) {
      return NextResponse.json({ customCategories: current })
    }

    const updated = [...current, name]

    await db
      .update(decks)
      .set({ customCategories: updated })
      .where(eq(decks.id, deckId))

    return NextResponse.json({ customCategories: updated, slug })
  } catch (error) {
    console.error('Custom category add error:', error)
    return NextResponse.json({ error: 'Failed to add custom category' }, { status: 500 })
  }
}

export async function DELETE(
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
    const slug: string = body.slug?.trim()

    if (!slug) {
      return NextResponse.json({ error: 'slug is required' }, { status: 400 })
    }

    const deck = await verifyOwnership(deckId, user.id)
    if (!deck) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const current: string[] = deck.customCategories ?? []

    // Filter out any entry whose slugified form matches the given slug
    const updated = current.filter(
      (name) => name.toLowerCase().replace(/\s+/g, '-') !== slug
    )

    await db
      .update(decks)
      .set({ customCategories: updated })
      .where(eq(decks.id, deckId))

    // Remove all deckCardCategories with this slug for cards in this deck
    const deckCardIds = db
      .select({ id: deckCards.id })
      .from(deckCards)
      .where(eq(deckCards.deckId, deckId))

    await db
      .delete(deckCardCategories)
      .where(
        and(
          inArray(deckCardCategories.deckCardId, deckCardIds),
          eq(deckCardCategories.category, slug)
        )
      )

    return NextResponse.json({ customCategories: updated })
  } catch (error) {
    console.error('Custom category remove error:', error)
    return NextResponse.json({ error: 'Failed to remove custom category' }, { status: 500 })
  }
}
