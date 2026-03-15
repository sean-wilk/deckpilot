import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { decks, deckCards, cards } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import Image from 'next/image'
import { Crown } from 'lucide-react'
import { StatsBar } from '@/components/deck/stats-bar'
import { DeckCardGrid } from '@/components/deck/deck-card-grid'
import { AddCardBar } from '@/components/deck/add-card-bar'
import { DeckPageHeader } from '@/components/deck/deck-page-header'
import { DeckPageSidebar } from '@/components/deck/deck-page-sidebar'
import { DeckSettingsButton } from '@/components/deck/deck-settings-button'
import { ExportDropdown } from '@/components/deck/export-dropdown'
import type { CardImageUris, CardFace } from '@/types/card'

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
      colors:       cards.colors,
      imageUris:    cards.imageUris,
      cardFaces:    cards.cardFaces,
      prices:       cards.prices,
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

        {/* Two-column layout */}
        <div className="flex gap-6 items-start mt-6">

          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* Commander section */}
            {commanderCards.length > 0 && (
              <section className="pb-4 border-b">
                <div className="flex items-center gap-2 mb-3">
                  <Crown className="size-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-foreground">Commander</h3>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="flex gap-4 flex-wrap rounded-lg bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-transparent p-4 border border-amber-500/20">
                  {commanderCards.map((c) => (
                    <div key={c.deckCardId} className="flex flex-col items-center gap-1.5">
                      <div className="relative">
                        <Image
                          src={
                            (c.imageUris as CardImageUris | null)?.normal ??
                            (c.cardFaces as CardFace[] | null)?.[0]?.image_uris?.normal ??
                            ''
                          }
                          alt={c.name}
                          width={244}
                          height={340}
                          className="rounded-[4.75%/3.4%] shadow-lg"
                        />
                        <div className="absolute -top-2 -left-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-[9px] font-bold uppercase tracking-wide shadow">
                          <Crown className="size-3" />
                          CMD
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground max-w-[244px] truncate text-center font-medium">
                        {c.name}
                      </span>
                    </div>
                  ))}
                  {partnerCard.length > 0 && (
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="relative">
                        <Image
                          src={
                            (partnerCard[0].imageUris as CardImageUris | null)?.normal ??
                            (partnerCard[0].cardFaces as CardFace[] | null)?.[0]?.image_uris?.normal ??
                            ''
                          }
                          alt={partnerCard[0].name}
                          width={244}
                          height={340}
                          className="rounded-[4.75%/3.4%] shadow-lg"
                        />
                        <div className="absolute -top-2 -left-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-[9px] font-bold uppercase tracking-wide shadow">
                          <Crown className="size-3" />
                          Partner
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground max-w-[244px] truncate text-center font-medium">
                        {partnerCard[0].name}
                      </span>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Add card bar */}
            {isOwner && (
              <AddCardBar deckId={id} />
            )}

            {/* Card grid grouped by type */}
            <DeckCardGrid
              deckId={id}
              cards={mainboardCards}
              isOwner={isOwner}
            />

            {/* Sideboard section */}
            <section className="pt-2">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Sideboard ({sideboardCards.length})
                </h3>
                <div className="flex-1 h-px bg-border" />
              </div>
              {sideboardCards.length > 0 ? (
                <DeckCardGrid
                  deckId={id}
                  cards={sideboardCards}
                  isOwner={isOwner}
                />
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No sideboard cards
                </p>
              )}
            </section>
          </div>

          {/* Right sidebar */}
          <div className="w-72 shrink-0">
            <DeckPageSidebar
              deckId={id}
              deck={deck}
              cardCount={rows.length}
              statsCards={statsCards}
              isOwner={isOwner}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
