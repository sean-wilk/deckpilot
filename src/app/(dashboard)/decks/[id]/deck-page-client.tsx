'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'
import { DeckContentTabs } from '@/components/deck/deck-content-tabs'
import { DeckPageSidebar } from '@/components/deck/deck-page-sidebar'
import { DeckCardGrid } from '@/components/deck/deck-card-grid'
import type { LegalityIssue } from '@/components/deck/deck-card-grid'
import { DeckDisplayControls } from '@/components/deck/deck-display-controls'
import { AddCardBar } from '@/components/deck/add-card-bar'
import { DeckHeroBanner } from '@/components/deck/deck-hero-banner'
import { DeckLegalityBanner } from '@/components/deck/deck-legality-banner'
import { useDeckUndo } from '@/hooks/use-deck-undo'
import type { CardImageUris, CardFace } from '@/types/card'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DeckCardEntry {
  deckCardId: string
  cardId: string
  cardType: string
  isCommander: boolean
  isSideboard: boolean
  quantity?: number
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
    spiciness: number
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

// ─── Card size store (useSyncExternalStore for hydration safety) ──────────────

const CARD_SIZE_DEFAULT = 200
const CARD_SIZE_KEY = 'deckpilot:card-size'

const _cardSizeListeners = new Set<() => void>()
const _subscribe = (cb: () => void) => {
  _cardSizeListeners.add(cb)
  // Listen for storage changes (from slider or other tabs)
  const handler = (e: StorageEvent) => { if (e.key === CARD_SIZE_KEY) cb() }
  window.addEventListener('storage', handler)
  return () => {
    _cardSizeListeners.delete(cb)
    window.removeEventListener('storage', handler)
  }
}
const _getCardSizeSnapshot = () => {
  try {
    const stored = localStorage.getItem(CARD_SIZE_KEY)
    if (stored) {
      const parsed = parseInt(stored, 10)
      if (!isNaN(parsed) && parsed >= 72 && parsed <= 350) return parsed
    }
  } catch {}
  return CARD_SIZE_DEFAULT
}
const _getServerSnapshot = () => CARD_SIZE_DEFAULT

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

  // ── Undo stack (single instance for both mainboard + sideboard grids) ─────
  const { pushUndo } = useDeckUndo()

  // ── Shared legality issues (lifted from banner so grids can show warning rings) ──
  const [legalityIssues, setLegalityIssues] = useState<LegalityIssue[]>([])

  // ── Card roles derived from analysis categories ──────────────────────────
  const [cardRoles, setCardRoles] = useState<Record<string, string[]>>({})

  useEffect(() => {
    async function deriveCardRoles() {
      try {
        const res = await fetch(`/api/ai/analysis/${deckId}`)
        if (!res.ok) return
        const data = await res.json()
        const results = data?.results
        if (!results?.categories) return

        const map: Record<string, string[]> = {}
        const allCategories = [
          ...(results.categories.core ?? []),
          ...(results.categories.deck_specific ?? []),
        ]
        for (const cat of allCategories) {
          const role = cat.name.toLowerCase().replace(/\s+/g, '-')
          for (const cardName of cat.cards ?? []) {
            if (!map[cardName]) map[cardName] = []
            if (!map[cardName].includes(role)) map[cardName].push(role)
          }
        }
        setCardRoles(map)
      } catch {
        // ignore fetch errors
      }
    }
    void deriveCardRoles()
  }, [deckId])

  // ── Display controls (Task 5.3) ────────────────────────────────────────────
  const [groupBy, setGroupBy] = useState<'type' | 'role' | 'cmc'>('type')
  // useSyncExternalStore ensures server snapshot (100) matches SSR output, while
  // client snapshot reads localStorage — eliminating the hydration mismatch.
  const cardSize = useSyncExternalStore(_subscribe, _getCardSizeSnapshot, _getServerSnapshot)
  const setCardSize = (size: number) => {
    try { localStorage.setItem(CARD_SIZE_KEY, String(size)) } catch {}
    _cardSizeListeners.forEach(cb => cb())
  }

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

        {/* Legality banner */}
        <DeckLegalityBanner deckId={deckId} refreshKey={cardCount} onIssuesLoaded={setLegalityIssues} />

        {/* Tabs with deck content */}
        <DeckContentTabs
          deckId={deckId}
          targetBracket={deck.targetBracket}
          cardCount={cardCount}
          categoryTargets={deck.categoryTargets}
          deckCardNames={[
            ...mainboardCards.map((c) => c.name),
            ...commanderCards.map((c) => c.name),
            ...sideboardCards.map((c) => c.name),
          ]}
          philosophy={deck.philosophy}
          archetype={deck.archetype}
          spiciness={deck.spiciness}
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
            legalityIssues={legalityIssues}
            pushUndo={pushUndo}
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
                legalityIssues={legalityIssues}
                pushUndo={pushUndo}
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
