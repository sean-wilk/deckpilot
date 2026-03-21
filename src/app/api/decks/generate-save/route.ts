import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { cards, decks, deckCards, deckVersions } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { deriveCardType } from '@/lib/utils/card-type'

interface GeneratedCard {
  name: string
  category: string
  reasoning: string
}

interface GenerateSaveRequest {
  commanderId: string
  name: string
  description: string
  targetBracket: number
  budgetLimitCents?: number
  spiciness?: number
  cards: GeneratedCard[]
  strategySummary?: string
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const body: GenerateSaveRequest = await request.json()
    const { commanderId, name, description, targetBracket, budgetLimitCents, spiciness: rawSpiciness, cards: generatedCards, strategySummary } = body
    const spiciness = rawSpiciness ?? 30

    if (!commanderId) {
      return NextResponse.json({ error: 'commanderId is required' }, { status: 400 })
    }
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    if (!generatedCards || generatedCards.length === 0) {
      return NextResponse.json({ error: 'cards array is required and must not be empty' }, { status: 400 })
    }
    if (generatedCards.length > 110) {
      return NextResponse.json({ error: 'Too many cards' }, { status: 400 })
    }
    if (typeof name !== 'string' || name.length > 200) {
      return NextResponse.json({ error: 'Invalid deck name' }, { status: 400 })
    }
    if (description && typeof description === 'string' && description.length > 10000) {
      return NextResponse.json({ error: 'Description too long' }, { status: 400 })
    }

    // Look up commander to get color identity
    const commanderRows = await db
      .select({ id: cards.id, colorIdentity: cards.colorIdentity })
      .from(cards)
      .where(eq(cards.id, commanderId))
      .limit(1)

    if (!commanderRows[0]) {
      return NextResponse.json({ error: 'Commander not found' }, { status: 404 })
    }

    const commanderColorIdentity = commanderRows[0].colorIdentity ?? []

    // Batch-lookup all card IDs + typeLines + colorIdentity by name (case-insensitive)
    const cardNames = generatedCards.map((c) => c.name.toLowerCase())

    const dbCards = await db
      .select({
        id: cards.id,
        name: cards.name,
        typeLine: cards.typeLine,
        colorIdentity: cards.colorIdentity,
      })
      .from(cards)
      .where(
        sql`LOWER(${cards.name}) IN (${sql.join(cardNames.map(n => sql`${n}`), sql`, `)})`
      )

    // Build a lookup map: lowercase name → db card (take first match per name)
    const dbCardMap = new Map<string, typeof dbCards[number]>()
    for (const dbCard of dbCards) {
      const key = dbCard.name.toLowerCase()
      if (!dbCardMap.has(key)) {
        dbCardMap.set(key, dbCard)
      }
    }

    const VALID_ROLES = new Set(['ramp', 'card_draw', 'removal', 'board_wipe', 'win_condition', 'protection', 'synergy', 'utility', 'creature', 'land'])

    // Process each generated card
    const missingCards: string[] = []
    const colorViolations: string[] = []

    interface DeckCardValue {
      cardId: string
      cardType: string
      functionalRole: string
      quantity: number
      isCommander: boolean
      isCompanion: boolean
      isSideboard: boolean
      sortOrder: number
    }

    const deckCardValues: DeckCardValue[] = []
    const seenCardIds = new Set<string>()  // deduplicate — unique constraint on (deckId, cardId)

    for (let i = 0; i < generatedCards.length; i++) {
      const gen = generatedCards[i]
      const dbCard = dbCardMap.get(gen.name.toLowerCase())

      if (!dbCard) {
        missingCards.push(gen.name)
        continue
      }

      // Color identity check — only truly colorless cards are exempt
      // Lands with color identity (triomes, shocklands, etc.) must still match commander colors
      const isColorless = !dbCard.colorIdentity || dbCard.colorIdentity.length === 0

      if (!isColorless) {
        const violatesColorIdentity = dbCard.colorIdentity.some(
          (c) => !commanderColorIdentity.includes(c)
        )
        if (violatesColorIdentity) {
          colorViolations.push(gen.name)
          continue
        }
      }

      // Handle duplicates: basic lands increment quantity, others are skipped
      if (seenCardIds.has(dbCard.id)) {
        const isBasicLand = dbCard.typeLine.toLowerCase().includes('basic land')
        if (isBasicLand) {
          // Increment quantity on existing entry
          const existing = deckCardValues.find(v => v.cardId === dbCard.id)
          if (existing) existing.quantity++
        }
        // Non-basic duplicates are silently skipped (Commander singleton rule)
        continue
      }
      seenCardIds.add(dbCard.id)

      deckCardValues.push({
        cardId: dbCard.id,
        cardType: deriveCardType(dbCard.typeLine),
        functionalRole: VALID_ROLES.has(gen.category) ? gen.category : 'utility',
        quantity: 1,
        isCommander: false,
        isCompanion: false,
        isSideboard: false,
        sortOrder: i,
      })
    }

    // Wrap everything in a transaction
    const result = await db.transaction(async (tx) => {
      // Build description with import notes if any cards were dropped
      let fullDescription = description ?? ''
      if (missingCards.length > 0 || colorViolations.length > 0) {
        const notes: string[] = []
        if (missingCards.length > 0) {
          notes.push(`Cards not found in database (${missingCards.length}): ${missingCards.join(', ')}`)
        }
        if (colorViolations.length > 0) {
          notes.push(`Cards removed for color identity (${colorViolations.length}): ${colorViolations.join(', ')}`)
        }
        fullDescription = fullDescription
          ? `${fullDescription}\n\n---\nImport Notes:\n${notes.join('\n')}`
          : `Import Notes:\n${notes.join('\n')}`
      }

      // Insert deck row
      const [deck] = await tx
        .insert(decks)
        .values({
          ownerId: user.id,
          name,
          description: fullDescription || null,
          commanderId,
          targetBracket,
          budgetLimitCents: budgetLimitCents ?? null,
          spiciness,
          philosophy: strategySummary ?? null,
        })
        .returning({ id: decks.id })

      // Bulk insert all deck cards (if any passed validation)
      if (deckCardValues.length > 0) {
        await tx.insert(deckCards).values(
          deckCardValues.map((v) => ({
            deckId: deck.id,
            cardId: v.cardId,
            cardType: v.cardType,
            functionalRole: v.functionalRole,
            quantity: v.quantity,
            isCommander: v.isCommander,
            isCompanion: v.isCompanion,
            isSideboard: v.isSideboard,
            sortOrder: v.sortOrder,
          }))
        )
      }

      // Create initial deck version snapshot
      await tx.insert(deckVersions).values({
        deckId: deck.id,
        versionNumber: 1,
        snapshot: {
          cards: deckCardValues,
          settings: { name, targetBracket },
          strategySummary: strategySummary ?? null,
        },
        changeSummary: 'AI-generated deck created',
      })

      return deck.id
    })

    return NextResponse.json({
      deckId: result,
      totalCards: deckCardValues.length,
      missingCards,
      colorViolations,
    })
  } catch (err) {
    console.error('Save deck error:', err)
    return NextResponse.json(
      { error: 'Failed to save generated deck' },
      { status: 500 }
    )
  }
}
