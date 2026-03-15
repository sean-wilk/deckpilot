'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Crown } from 'lucide-react'
import { DeckContentTabs } from '@/components/deck/deck-content-tabs'
import { DeckPageSidebar } from '@/components/deck/deck-page-sidebar'
import { DeckCardGrid } from '@/components/deck/deck-card-grid'
import { AddCardBar } from '@/components/deck/add-card-bar'
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
    format: string
    isPublic: boolean
    budgetLimitCents: number | null
    targetBracket: number
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

  return (
    <div className="flex gap-6 items-start">
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
                        c.imageUris?.normal ??
                        c.cardFaces?.[0]?.image_uris?.normal ??
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
              {partnerCard && (
                <div className="flex flex-col items-center gap-1.5">
                  <div className="relative">
                    <Image
                      src={
                        partnerCard.imageUris?.normal ??
                        partnerCard.cardFaces?.[0]?.image_uris?.normal ??
                        ''
                      }
                      alt={partnerCard.name}
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
                    {partnerCard.name}
                  </span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Tabs with deck content */}
        <DeckContentTabs
          deckId={deckId}
          targetBracket={deck.targetBracket}
          cardCount={cardCount}
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
