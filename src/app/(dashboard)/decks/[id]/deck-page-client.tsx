'use client'

import { useState } from 'react'
import { DeckContentTabs } from '@/components/deck/deck-content-tabs'
import { DeckPageSidebar } from '@/components/deck/deck-page-sidebar'
import { DeckCardGrid } from '@/components/deck/deck-card-grid'
import { AddCardBar } from '@/components/deck/add-card-bar'
import { DeckHeroBanner } from '@/components/deck/deck-hero-banner'
import type { CardImageUris, CardFace } from '@/types/card'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DeckCardEntry {
  deckCardId: string
  cardId: string
  cardType: string
  isCommander: boolean
  isSideboard: boolean
  name: string
  manaCost: string | null
  cmc: number
  imageUris: CardImageUris | null
  cardFaces: CardFace[] | null
}

interface DeckPageClientProps {
  deckId: string
  deck: {
    name: string
    format: string
    isPublic: boolean
    budgetLimitCents: number | null
    targetBracket: number
    philosophy: string | null
    archetype: string | null
    categoryTargets: Record<string, number> | null
  }
  mainboardCards: DeckCardEntry[]
  sideboardCards: DeckCardEntry[]
  commanderCards: DeckCardEntry[]
  partnerCard: {
    name: string
    imageUris: CardImageUris | null
    cardFaces: CardFace[] | null
  } | null
  isOwner: boolean
  statsCards: { cmc: number; colors: string[]; prices: Record<string, string | null> | null }[]
  cardCount: number
}

// ─── DeckPageClient ───────────────────────────────────────────────────────────

export function DeckPageClient({
  deckId,
  deck,
  mainboardCards,
  sideboardCards,
  commanderCards,
  partnerCard,
  isOwner,
  statsCards,
  cardCount,
}: DeckPageClientProps) {
  const [activeTab, setActiveTab] = useState('deck')

  const primaryCommander = commanderCards[0] ?? null

  return (
    <div className="flex gap-6 items-start">
      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-5">
        {/* Hero banner */}
        {primaryCommander && (
          <DeckHeroBanner
            deck={{
              name: deck.name,
              targetBracket: deck.targetBracket,
              archetype: deck.archetype,
            }}
            commanderImageUris={primaryCommander.imageUris as Record<string, string> | null}
            commanderCardFaces={primaryCommander.cardFaces as Array<{ image_uris?: Record<string, string> }> | null}
            commanderName={primaryCommander.name}
            partnerImageUris={partnerCard?.imageUris as Record<string, string> | null | undefined}
            partnerName={partnerCard?.name}
            cardCount={cardCount}
          />
        )}

        {/* Tabs with deck content */}
        <DeckContentTabs
          deckId={deckId}
          targetBracket={deck.targetBracket}
          cardCount={cardCount}
          categoryTargets={deck.categoryTargets}
          philosophy={deck.philosophy}
          archetype={deck.archetype}
          isOwner={isOwner}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        >
          {/* Deck tab content */}
          {isOwner && (
            <AddCardBar deckId={deckId} />
          )}

          <DeckCardGrid
            deckId={deckId}
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
                deckId={deckId}
                cards={sideboardCards}
                isOwner={isOwner}
              />
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No sideboard cards
              </p>
            )}
          </section>
        </DeckContentTabs>
      </div>

      {/* Right sidebar */}
      <div className="w-72 shrink-0">
        <DeckPageSidebar
          deckId={deckId}
          deck={deck}
          cardCount={cardCount}
          statsCards={statsCards}
          isOwner={isOwner}
          onAnalyze={() => setActiveTab('analysis')}
          onRecommend={() => setActiveTab('recommendations')}
        />
      </div>
    </div>
  )
}
