'use client'

import { useState, useTransition } from 'react'
import { CardImage } from '@/components/cards/card-image'
import { cn } from '@/lib/utils'
import type { CardImageUris, CardFace } from '@/types/card'
import { removeCardFromDeck } from '@/app/(dashboard)/decks/actions'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeckCardEntry {
  deckCardId: string
  cardId: string
  name: string
  cardType: string
  isCommander: boolean
  imageUris: CardImageUris | null
  cardFaces: CardFace[] | null
  manaCost: string | null
  cmc: number
}

export interface DeckCardGridProps {
  deckId: string
  cards: DeckCardEntry[]
  isOwner: boolean
}

// ─── Type ordering & display ──────────────────────────────────────────────────

const TYPE_ORDER = [
  'creature',
  'planeswalker',
  'battle',
  'instant',
  'sorcery',
  'enchantment',
  'artifact',
  'land',
  'other',
]

const TYPE_LABELS: Record<string, string> = {
  creature:     'Creatures',
  planeswalker: 'Planeswalkers',
  battle:       'Battles',
  instant:      'Instants',
  sorcery:      'Sorceries',
  enchantment:  'Enchantments',
  artifact:     'Artifacts',
  land:         'Lands',
  other:        'Other',
}

// ─── Card thumbnail ────────────────────────────────────────────────────────────

interface CardThumbProps {
  card: DeckCardEntry
  deckId: string
  isOwner: boolean
}

function CardThumb({ card, deckId, isOwner }: CardThumbProps) {
  const [hovered, setHovered] = useState(false)
  const [removing, startRemove] = useTransition()

  function handleRemove() {
    startRemove(async () => {
      await removeCardFromDeck(deckId, card.deckCardId)
    })
  }

  return (
    <div
      className="relative group flex flex-col items-center gap-1"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Card image */}
      <div className="relative">
        <CardImage
          name={card.name}
          imageUris={card.imageUris}
          cardFaces={card.cardFaces}
          size="small"
          className={cn(
            'transition-transform duration-200',
            hovered && 'scale-105 shadow-xl',
            removing && 'opacity-50',
          )}
        />

        {/* Hover overlay: remove button */}
        {isOwner && hovered && !card.isCommander && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={removing}
            className={cn(
              'absolute -top-1.5 -right-1.5 z-20',
              'size-5 rounded-full',
              'bg-destructive text-destructive-foreground',
              'flex items-center justify-center',
              'text-xs font-bold leading-none',
              'shadow-md border border-background',
              'transition-all duration-150',
              'hover:scale-110',
              'disabled:opacity-50',
            )}
            aria-label={`Remove ${card.name} from deck`}
          >
            ×
          </button>
        )}

        {/* Commander badge */}
        {card.isCommander && (
          <div className="absolute -top-1.5 -left-1.5 z-20 px-1 py-0.5 rounded-sm bg-amber-500 text-white text-[8px] font-bold uppercase tracking-wide shadow">
            CMD
          </div>
        )}
      </div>

      {/* Card name */}
      <span className="text-[10px] text-center text-muted-foreground leading-tight max-w-[88px] truncate">
        {card.name}
      </span>
    </div>
  )
}

// ─── Type group ───────────────────────────────────────────────────────────────

interface TypeGroupProps {
  type: string
  cards: DeckCardEntry[]
  deckId: string
  isOwner: boolean
}

function TypeGroup({ type, cards, deckId, isOwner }: TypeGroupProps) {
  const label = TYPE_LABELS[type] ?? type.charAt(0).toUpperCase() + type.slice(1)

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold text-foreground">
          {label}
        </h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          ({cards.length})
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="flex flex-wrap gap-3">
        {cards.map((card) => (
          <CardThumb
            key={card.deckCardId}
            card={card}
            deckId={deckId}
            isOwner={isOwner}
          />
        ))}
      </div>
    </section>
  )
}

// ─── DeckCardGrid ─────────────────────────────────────────────────────────────

export function DeckCardGrid({ deckId, cards, isOwner }: DeckCardGridProps) {
  // Group by cardType
  const grouped = new Map<string, DeckCardEntry[]>()
  for (const card of cards) {
    const key = card.cardType ?? 'other'
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(card)
  }

  // Sort groups by canonical order
  const sortedTypes = TYPE_ORDER.filter((t) => grouped.has(t))
  const extraTypes = [...grouped.keys()].filter((t) => !TYPE_ORDER.includes(t))

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-4xl mb-3">🃏</div>
        <p className="text-sm font-medium text-muted-foreground">No cards yet</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Search for cards above to build your deck</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {[...sortedTypes, ...extraTypes].map((type) => (
        <TypeGroup
          key={type}
          type={type}
          cards={grouped.get(type)!}
          deckId={deckId}
          isOwner={isOwner}
        />
      ))}
    </div>
  )
}
