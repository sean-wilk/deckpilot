import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { decks, deckCards, cards } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import Image from 'next/image'
import { StatsBar } from '@/components/deck/stats-bar'
import { DeckCardGrid } from '@/components/deck/deck-card-grid'
import { AddCardBar } from '@/components/deck/add-card-bar'
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

  const BRACKET_LABELS: Record<number, string> = {
    1: 'Precon',
    2: 'Upgraded',
    3: 'Optimized',
    4: 'cEDH',
  }

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
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {deck.name}
            </h1>
            {deck.description && (
              <p className="mt-1 text-sm text-muted-foreground max-w-prose">
                {deck.description}
              </p>
            )}
          </div>
          <span className="shrink-0 inline-flex items-center px-3 py-1 rounded-full border text-sm font-semibold bg-muted text-muted-foreground">
            Bracket {deck.targetBracket}
            {BRACKET_LABELS[deck.targetBracket] && ` — ${BRACKET_LABELS[deck.targetBracket]}`}
          </span>
        </div>

        {/* Two-column layout */}
        <div className="flex gap-6 items-start">

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
          <aside className="w-72 shrink-0 space-y-4">
            {/* AI Panel placeholder */}
            <div className="rounded-xl border bg-muted/30 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="size-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                  <svg className="size-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-foreground">AI Panel</h3>
                <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200">
                  Phase 6
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                AI-powered deck analysis, synergy suggestions, and swap recommendations are coming in Phase 6.
              </p>
              <div className="mt-3 space-y-2">
                {['Synergy Analysis', 'Swap Recommendations', 'Bracket Check', 'Budget Optimizer'].map((feature) => (
                  <div key={feature} className="flex items-center gap-2 opacity-50">
                    <div className="size-1.5 rounded-full bg-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Deck meta */}
            <div className="rounded-xl border bg-background p-4 space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Deck Info
              </h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Format</span>
                  <span className="font-medium capitalize">{deck.format}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Visibility</span>
                  <span className="font-medium">{deck.isPublic ? 'Public' : 'Private'}</span>
                </div>
                {deck.budgetLimitCents && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Budget</span>
                    <span className="font-medium">
                      ${(deck.budgetLimitCents / 100).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cards</span>
                  <span className="font-medium tabular-nums">{rows.length} / 100</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
