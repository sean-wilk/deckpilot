import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { deckCards, decks, cards } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

// ─── Types ─────────────────────────────────────────────────────────────────

interface LegalityIssue {
  cardId: string
  cardName: string
  deckCardId: string
  type: 'color_identity' | 'banned' | 'not_legal' | 'over_limit'
  message: string
}

// ─── GET /api/decks/[deckId]/legality ──────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    const { deckId } = await params

    // Auth — allow public deck viewing without login
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Fetch deck for format + commander color identity
    const [deck] = await db
      .select({
        id: decks.id,
        ownerId: decks.ownerId,
        isPublic: decks.isPublic,
        format: decks.format,
        commanderId: decks.commanderId,
        partnerId: decks.partnerId,
      })
      .from(decks)
      .where(eq(decks.id, deckId))
      .limit(1)

    if (!deck) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Visibility check
    const isOwner = user?.id === deck.ownerId
    if (!deck.isPublic && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch commander color identity
    const commanderRows = await db
      .select({ colorIdentity: cards.colorIdentity })
      .from(cards)
      .where(eq(cards.id, deck.commanderId))
      .limit(1)

    const commanderColorIdentity = new Set(commanderRows[0]?.colorIdentity ?? [])

    // If there's a partner, merge their color identity
    if (deck.partnerId) {
      const partnerRows = await db
        .select({ colorIdentity: cards.colorIdentity })
        .from(cards)
        .where(eq(cards.id, deck.partnerId))
        .limit(1)
      for (const color of (partnerRows[0]?.colorIdentity ?? [])) {
        commanderColorIdentity.add(color)
      }
    }

    // Fetch all deck cards with card data
    const rows = await db
      .select({
        deckCardId:    deckCards.id,
        cardId:        deckCards.cardId,
        quantity:      deckCards.quantity,
        isCommander:   deckCards.isCommander,
        name:          cards.name,
        colorIdentity: cards.colorIdentity,
        legalities:    cards.legalities,
        typeLine:      cards.typeLine,
      })
      .from(deckCards)
      .innerJoin(cards, eq(deckCards.cardId, cards.id))
      .where(eq(deckCards.deckId, deckId))

    const issues: LegalityIssue[] = []
    const format = deck.format ?? 'commander'

    for (const row of rows) {
      // Skip commanders — they define identity, don't violate it
      if (row.isCommander) continue

      // ── Color identity check ──────────────────────────────────────────
      const cardColors = row.colorIdentity as string[]
      const offColors = cardColors.filter((c) => !commanderColorIdentity.has(c))
      if (offColors.length > 0) {
        issues.push({
          cardId:     row.cardId,
          cardName:   row.name,
          deckCardId: row.deckCardId,
          type:       'color_identity',
          message:    `Color identity {${offColors.join(', ')}} outside commander's identity`,
        })
        continue // No need to check other issues for this card
      }

      // ── Format legality check ─────────────────────────────────────────
      const legalities = row.legalities as Record<string, string> | null
      if (legalities) {
        const status = legalities[format]
        if (status === 'banned') {
          issues.push({
            cardId:     row.cardId,
            cardName:   row.name,
            deckCardId: row.deckCardId,
            type:       'banned',
            message:    `Banned in ${format}`,
          })
        } else if (status === 'not_legal') {
          issues.push({
            cardId:     row.cardId,
            cardName:   row.name,
            deckCardId: row.deckCardId,
            type:       'not_legal',
            message:    `Not legal in ${format}`,
          })
        }
      }

      // ── Quantity check (commander: max 1 copy, basic lands exempt) ────
      if (format === 'commander' && (row.quantity ?? 1) > 1) {
        const typeLine = (row.typeLine ?? '') as string
        const isBasicLand = /\bBasic\b/i.test(typeLine)
        if (!isBasicLand) {
          issues.push({
            cardId:     row.cardId,
            cardName:   row.name,
            deckCardId: row.deckCardId,
            type:       'over_limit',
            message:    `Only 1 copy allowed in commander (has ${row.quantity})`,
          })
        }
      }
    }

    return NextResponse.json({ issues })
  } catch (error) {
    console.error('Legality check error:', error)
    return NextResponse.json({ error: 'Failed to check legality' }, { status: 500 })
  }
}
