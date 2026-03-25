import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { decks, deckCards, cards, type BoardType } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { StatsBar } from '@/components/deck/stats-bar'
import { DeckPageHeader } from '@/components/deck/deck-page-header'
import { DeckSettingsButton } from '@/components/deck/deck-settings-button'
import { ExportDropdown } from '@/components/deck/export-dropdown'
import type { CardImageUris, CardFace } from '@/types/card'
import type { DeckCardEntry } from '@/components/deck/deck-card-grid'
import { DeckPageClient } from './deck-page-client'

// ─── Page ─────────────────────────────────────────────────────────────────────

interface DeckPageProps {
  params: Promise<{ id: string }>
}

export default async function DeckPage({ params }: DeckPageProps) {
  const { id } = await params

  // Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch deck
  const [deck] = await db
    .select()
    .from(decks)
    .where(eq(decks.id, id))
    .limit(1)

  if (!deck) notFound()

  // Ownership / visibility check
  const isOwner = user?.id === deck.ownerId
  if (!deck.isPublic && !isOwner) {
    redirect('/decks')
  }

  // Fetch commander card by commanderId (authoritative source for hero banner + grid fallback)
  const commanderCardData = deck.commanderId ? await db
    .select({
      id: cards.id,
      name: cards.name,
      manaCost: cards.manaCost,
      cmc: cards.cmc,
      typeLine: cards.typeLine,
      oracleText: cards.oracleText,
      power: cards.power,
      toughness: cards.toughness,
      rarity: cards.rarity,
      setCode: cards.setCode,
      imageUris: cards.imageUris,
      cardFaces: cards.cardFaces,
      prices: cards.prices,
    })
    .from(cards)
    .where(eq(cards.id, deck.commanderId))
    .limit(1)
  : []

  // Fetch partner commander card if set
  const partnerCard = deck.partnerId
    ? await db
        .select({
          name: cards.name,
          imageUris: cards.imageUris,
          cardFaces: cards.cardFaces,
        })
        .from(cards)
        .where(eq(cards.id, deck.partnerId))
        .limit(1)
    : []

  // Fetch deck cards joined with card data
  const rows = await db
    .select({
      // deck_cards fields
      deckCardId:   deckCards.id,
      cardId:       deckCards.cardId,
      cardType:     deckCards.cardType,
      isCommander:  deckCards.isCommander,
      board:        deckCards.board,
      quantity:     deckCards.quantity,
      sortOrder:    deckCards.sortOrder,
      // cards fields
      name:         cards.name,
      manaCost:     cards.manaCost,
      cmc:          cards.cmc,
      typeLine:     cards.typeLine,
      oracleText:   cards.oracleText,
      power:        cards.power,
      toughness:    cards.toughness,
      rarity:       cards.rarity,
      setCode:      cards.setCode,
      colors:       cards.colors,
      imageUris:    cards.imageUris,
      cardFaces:    cards.cardFaces,
      prices:       cards.prices,
      userNote:     deckCards.userNote,
    })
    .from(deckCards)
    .innerJoin(cards, eq(deckCards.cardId, cards.id))
    .where(eq(deckCards.deckId, id))
    .orderBy(asc(deckCards.sortOrder))

  // Shape data for components
  const deckCardEntries = rows.map((row) => ({
    deckCardId:  row.deckCardId,
    cardId:      row.cardId,
    cardType:    row.cardType,
    isCommander: row.isCommander,
    board:       row.board as BoardType,
    quantity:    row.quantity,
    name:        row.name,
    manaCost:    row.manaCost,
    cmc:         parseFloat(row.cmc),
    imageUris:   row.imageUris as CardImageUris | null,
    cardFaces:   row.cardFaces as CardFace[] | null,
    typeLine:    row.typeLine,
    oracleText:  row.oracleText ?? null,
    power:       row.power ?? null,
    toughness:   row.toughness ?? null,
    rarity:      row.rarity ?? null,
    setCode:     row.setCode ?? null,
    prices:      row.prices as Record<string, string | null> | null,
    userNote:    row.userNote ?? null,
  }))

  // Stats only count mainboard cards (exclude sideboard and maybe)
  const mainboardRows = rows.filter((r) => r.board === 'main')
  const statsCards = mainboardRows.map((row) => ({
    cmc:      parseFloat(row.cmc),
    colors:   row.colors,
    prices:   row.prices as Record<string, string | null> | null,
    quantity: row.quantity,
  }))

  // Identify commander cards: first try isCommander flag, then match by commanderId
  let commanderCards = deckCardEntries.filter((c) => c.isCommander)
  if (commanderCards.length === 0 && deck.commanderId) {
    // Try matching by cardId in deck entries
    const commanderEntry = deckCardEntries.find((c) => c.cardId === deck.commanderId)
    if (commanderEntry) {
      commanderCards = [{ ...commanderEntry, isCommander: true }]
    } else if (commanderCardData.length > 0) {
      // Commander not in deck_cards at all (e.g., generated decks) — construct virtual entry
      const cmd = commanderCardData[0]
      commanderCards = [{
        deckCardId: `commander-${deck.commanderId}`,
        cardId: cmd.id,
        name: cmd.name,
        cardType: 'creature',
        isCommander: true,
        board: 'main' as const,
        quantity: 1,
        imageUris: cmd.imageUris as DeckCardEntry['imageUris'],
        cardFaces: cmd.cardFaces as DeckCardEntry['cardFaces'],
        manaCost: cmd.manaCost,
        cmc: parseFloat(cmd.cmc?.toString() ?? '0'),
        userNote: null,
        typeLine: cmd.typeLine,
        oracleText: cmd.oracleText,
        power: cmd.power,
        toughness: cmd.toughness,
        rarity: cmd.rarity,
        setCode: cmd.setCode,
        prices: (cmd.prices as Record<string, string | null>) ?? null,
      }]
    }
  }
  const commanderCardIds = new Set(commanderCards.map(c => c.deckCardId))
  const gridCards = deckCardEntries.filter((c) => !commanderCardIds.has(c.deckCardId))
  const mainboardCards = gridCards.filter((c) => c.board === 'main')
  const sideboardCards = gridCards.filter((c) => c.board === 'side')
  const maybeboardCards = gridCards.filter((c) => c.board === 'maybe')

  // Shape cards for ExportDropdown
  const exportCards = rows.map((row) => ({
    quantity: row.quantity,
    name:     row.name,
    isCommander: row.isCommander,
    board:    row.board as BoardType,
  }))

  // Sum quantities for accurate card count
  const cardCount = rows.reduce((sum, r) => sum + (r.quantity ?? 1), 0)

  return (
    <div className="min-h-screen bg-background -mx-4 -mt-8">
      {/* Stats bar — sticky at top */}
      <StatsBar
        cards={statsCards}
        deckName={deck.name}
        targetBracket={deck.targetBracket}
      />

      {/* Page content */}
      <div className="container mx-auto px-4 py-6">

        {/* Deck header */}
        <DeckPageHeader
          deck={deck}
          isOwner={isOwner}
          cardCount={cardCount}
        >
          <ExportDropdown cards={exportCards} />
          <DeckSettingsButton deck={deck} />
        </DeckPageHeader>

        {/* Two-column layout with shared tab state */}
        <div className="mt-6">
          <DeckPageClient
            deckId={id}
            deck={{
              name: deck.name,
              format: deck.format,
              isPublic: deck.isPublic,
              budgetLimitCents: deck.budgetLimitCents,
              targetBracket: deck.targetBracket,
              philosophy: deck.philosophy,
              archetype: deck.archetype,
              categoryTargets: deck.categoryTargets as Record<string, number> | null,
              spiciness: deck.spiciness,
            }}
            mainboardCards={mainboardCards}
            sideboardCards={sideboardCards}
            maybeboardCards={maybeboardCards}
            commanderCards={commanderCards}
            commanderCard={commanderCardData.length > 0 ? {
              name: commanderCardData[0].name,
              imageUris: commanderCardData[0].imageUris as CardImageUris | null,
              cardFaces: commanderCardData[0].cardFaces as CardFace[] | null,
            } : null}
            partnerCard={partnerCard.length > 0 ? {
              name: partnerCard[0].name,
              imageUris: partnerCard[0].imageUris as CardImageUris | null,
              cardFaces: partnerCard[0].cardFaces as CardFace[] | null,
            } : null}
            isOwner={isOwner}
            statsCards={statsCards}
            cardCount={cardCount}
          />
        </div>
      </div>
    </div>
  )
}
