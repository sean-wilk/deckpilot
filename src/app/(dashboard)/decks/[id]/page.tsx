import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { decks, deckCards, cards } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { StatsBar } from '@/components/deck/stats-bar'
import { DeckPageHeader } from '@/components/deck/deck-page-header'
import { DeckSettingsButton } from '@/components/deck/deck-settings-button'
import { ExportDropdown } from '@/components/deck/export-dropdown'
import type { CardImageUris, CardFace } from '@/types/card'
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

  // Fetch commander card by commanderId (authoritative source for hero banner)
  const commanderCardData = await db
    .select({
      name: cards.name,
      imageUris: cards.imageUris,
      cardFaces: cards.cardFaces,
    })
    .from(cards)
    .where(eq(cards.id, deck.commanderId))
    .limit(1)

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
      isSideboard:  deckCards.isSideboard,
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
    isSideboard: row.isSideboard,
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

  // Stats only count mainboard cards (exclude sideboard)
  const mainboardRows = rows.filter((r) => !r.isSideboard)
  const statsCards = mainboardRows.map((row) => ({
    cmc:    parseFloat(row.cmc),
    colors: row.colors,
    prices: row.prices as Record<string, string | null> | null,
  }))

  // Non-commander cards for the grid
  const gridCards = deckCardEntries.filter((c) => !c.isCommander)
  const commanderCards = deckCardEntries.filter((c) => c.isCommander)
  const mainboardCards = gridCards.filter((c) => !c.isSideboard)
  const sideboardCards = gridCards.filter((c) => c.isSideboard)

  // Shape cards for ExportDropdown
  const exportCards = rows.map((row) => ({
    quantity: row.quantity,
    name:     row.name,
    isCommander: row.isCommander,
    isSideboard: row.isSideboard,
  }))

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
          cardCount={rows.length}
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
            }}
            mainboardCards={mainboardCards}
            sideboardCards={sideboardCards}
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
            cardCount={rows.length}
          />
        </div>
      </div>
    </div>
  )
}
