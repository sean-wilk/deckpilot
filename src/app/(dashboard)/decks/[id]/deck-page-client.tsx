'use client'

import { useState, useEffect } from 'react'
import { DeckContentTabs } from '@/components/deck/deck-content-tabs'
import { DeckPageSidebar } from '@/components/deck/deck-page-sidebar'
import { DeckCardGrid } from '@/components/deck/deck-card-grid'
import { DeckDisplayControls, getInitialCardSize } from '@/components/deck/deck-display-controls'
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
  typeLine?: string | null
  oracleText?: string | null
  power?: string | null
  toughness?: string | null
  rarity?: string | null
  setCode?: string | null
  prices?: Record<string, string | null> | null
  userNote: string | null
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
  /** Authoritative commander card fetched directly from decks.commanderId — used as fallback when commanderCards is empty */
  commanderCard: {
    name: string
    imageUris: CardImageUris | null
    cardFaces: CardFace[] | null
  } | null
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
  commanderCard,
  partnerCard,
  isOwner,
  statsCards,
  cardCount,
}: DeckPageClientProps) {
  const [activeTab, setActiveTab] = useState('deck')

  // ── Card roles (Task 4.4) ──────────────────────────────────────────────────
  const [cardRoles, setCardRoles] = useState<Record<string, string[]>>({})

  useEffect(() => {
    async function fetchCardRoles() {
      try {
        const res = await fetch(`/api/ai/analysis/${deckId}`)
        if (!res.ok) return
        const data = await res.json()
        const roles = data?.result?.card_roles
        if (roles && typeof roles === 'object') {
          const map: Record<string, string[]> = {}
          for (const [cardId, roleValue] of Object.entries(roles)) {
            if (Array.isArray(roleValue)) {
              map[cardId] = roleValue as string[]
            } else if (typeof roleValue === 'string') {
              map[cardId] = [roleValue]
            }
          }
          setCardRoles(map)
        }
      } catch {
        // ignore fetch errors
      }
    }
    void fetchCardRoles()
  }, [deckId])

  // ── Display controls (Task 5.3) ────────────────────────────────────────────
  const [groupBy, setGroupBy] = useState<'type' | 'role' | 'cmc'>('type')
  // Initialize from localStorage if available (lazy initializer avoids hydration mismatch
  // because the value is resolved during the first client render, not via useEffect)
  const [cardSize, setCardSize] = useState(() => {
    if (typeof window === 'undefined') return 100
    return getInitialCardSize()
  })

  // Use the deck_cards commander entry if available; fall back to the
  // authoritative card fetched directly from decks.commanderId
  const primaryCommander = commanderCards[0] ?? null
  const heroImageUris = primaryCommander
    ? primaryCommander.imageUris as Record<string, string> | null
    : commanderCard?.imageUris as Record<string, string> | null ?? null
  const heroCardFaces = primaryCommander
    ? primaryCommander.cardFaces as Array<{ image_uris?: Record<string, string> }> | null
    : commanderCard?.cardFaces as Array<{ image_uris?: Record<string, string> }> | null ?? null
  const heroName = primaryCommander?.name ?? commanderCard?.name ?? ''
  const showHero = primaryCommander !== null || commanderCard !== null

  return (
    <div className="flex gap-6 items-start">
      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-5">
        {/* Hero banner */}
        {showHero && (
          <DeckHeroBanner
            deck={{
              name: deck.name,
              targetBracket: deck.targetBracket,
              archetype: deck.archetype,
            }}
            commanderImageUris={heroImageUris}
            commanderCardFaces={heroCardFaces}
            commanderName={heroName}
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

          <DeckDisplayControls
            groupBy={groupBy}
            onGroupByChange={setGroupBy}
            cardSize={cardSize}
            onCardSizeChange={setCardSize}
          />

          <DeckCardGrid
            deckId={deckId}
            cards={mainboardCards}
            isOwner={isOwner}
            cardRoles={cardRoles}
            groupBy={groupBy}
            cardSize={cardSize}
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
                cardRoles={cardRoles}
                groupBy={groupBy}
                cardSize={cardSize}
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
