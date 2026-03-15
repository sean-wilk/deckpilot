import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { decks, deckCards, cards } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import Image from 'next/image'
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

  // Fetch deck cards joined with card data
  const rows = await db
    .select({
      // deck_cards fields
      deckCardId:   deckCards.id,
      cardId:       deckCards.cardId,
      cardType:     deckCards.cardType,
      isCommander:  deckCards.isCommander,
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
    name:        row.name,
    manaCost:    row.manaCost,
    cmc:         parseFloat(row.cmc),
    imageUris:   row.imageUris as CardImageUris | null,
    cardFaces:   row.cardFaces as CardFace[] | null,
  }))

  const statsCards = rows.map((row) => ({
    cmc:    parseFloat(row.cmc),
    colors: row.colors,
    prices: row.prices as Record<string, string | null> | null,
  }))

  // Non-commander cards for the grid
  const gridCards = deckCardEntries.filter((c) => !c.isCommander)
  const commanderCards = deckCardEntries.filter((c) => c.isCommander)

  // Shape cards for ExportDropdown
  const exportCards = rows.map((row) => ({
    quantity: row.quantity,
    name:     row.name,
    isCommander: row.isCommander,
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
                  <h3 className="text-sm font-semibold text-foreground">Commander</h3>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="flex gap-3 flex-wrap">
                  {commanderCards.map((c) => (
                    <div key={c.deckCardId} className="flex flex-col items-center gap-1">
                      <div className="relative">
                        {/* CardImage rendered directly — commanders not removable */}
                        <Image
                          src={
                            (c.imageUris as CardImageUris | null)?.small ??
                            (c.cardFaces as CardFace[] | null)?.[0]?.image_uris?.small ??
                            ''
                          }
                          alt={c.name}
                          width={88}
                          height={123}
                          className="rounded-[4.75%/3.4%] shadow-md"
                        />
                        <div className="absolute -top-1.5 -left-1.5 px-1 py-0.5 rounded-sm bg-amber-500 text-white text-[8px] font-bold uppercase tracking-wide shadow">
                          CMD
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground max-w-[88px] truncate text-center">
                        {c.name}
                      </span>
                    </div>
                  ))}
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
              cards={gridCards}
              isOwner={isOwner}
            />
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
