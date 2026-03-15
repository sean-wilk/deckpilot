'use client'

import { useState, useTransition } from 'react'
import { ArrowUpDown } from 'lucide-react'
import { CardImage } from '@/components/cards/card-image'
import { CardDetailModal } from '@/components/cards/card-detail-modal'
import { cn } from '@/lib/utils'
import type { CardImageUris, CardFace } from '@/types/card'
import { removeCardFromDeck, toggleSideboard } from '@/app/(dashboard)/decks/actions'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeckCardEntry {
  deckCardId: string
  cardId: string
  name: string
  cardType: string
  isCommander: boolean
  isSideboard: boolean
  imageUris: CardImageUris | null
  cardFaces: CardFace[] | null
  manaCost: string | null
  cmc: number
  // Additional fields for detail modal
  typeLine?: string | null
  oracleText?: string | null
  power?: string | null
  toughness?: string | null
  rarity?: string | null
  setCode?: string | null
  prices?: Record<string, string | null> | null
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
  onCardClick: (card: DeckCardEntry) => void
}

function CardThumb({ card, deckId, isOwner, onCardClick }: CardThumbProps) {
  const [hovered, setHovered] = useState(false)
  const [removing, startRemove] = useTransition()
  const [toggling, startToggle] = useTransition()

  function handleRemove() {
    startRemove(async () => {
      await removeCardFromDeck(deckId, card.deckCardId)
    })
  }

  function handleToggleSideboard() {
    startToggle(async () => {
      await toggleSideboard(deckId, card.deckCardId)
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
        <button
          type="button"
          onClick={() => onCardClick(card)}
          className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[4.75%]"
          aria-label={`View details for ${card.name}`}
        >
        <CardImage
          name={card.name}
          imageUris={card.imageUris}
          cardFaces={card.cardFaces}
          size="small"
          className={cn(
            'transition-transform duration-200',
            hovered && 'scale-105 shadow-xl',
            (removing || toggling) && 'opacity-50',
          )}
        />
        </button>

        {/* Hover overlay: action buttons */}
        {isOwner && hovered && !card.isCommander && (
          <div className="absolute -top-1.5 -right-1.5 z-20 flex flex-col gap-1">
            {/* Remove button */}
            <button
              type="button"
              onClick={handleRemove}
              disabled={removing}
              className={cn(
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

            {/* Toggle sideboard button */}
            <button
              type="button"
              onClick={handleToggleSideboard}
              disabled={toggling}
              title={card.isSideboard ? 'Move to mainboard' : 'Move to sideboard'}
              className={cn(
                'size-5 rounded-full',
                'bg-secondary text-secondary-foreground',
                'flex items-center justify-center',
                'shadow-md border border-background',
                'transition-all duration-150',
                'hover:scale-110',
                'disabled:opacity-50',
              )}
              aria-label={card.isSideboard ? `Move ${card.name} to mainboard` : `Move ${card.name} to sideboard`}
            >
              <ArrowUpDown className="size-3" />
            </button>
          </div>
        )}

        {/* Commander badge */}
        {card.isCommander && (
          <div className="absolute -top-1.5 -left-1.5 z-20 px-1 py-0.5 rounded-sm bg-amber-500 text-white text-[8px] font-bold uppercase tracking-wide shadow">
            CMD
          </div>
        )}

        {/* Sideboard badge */}
        {card.isSideboard && (
          <div className="absolute -bottom-1.5 -left-1.5 z-20 px-1 py-0.5 rounded-sm bg-blue-500 text-white text-[8px] font-bold uppercase tracking-wide shadow">
            SB
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
  onCardClick: (card: DeckCardEntry) => void
}

function TypeGroup({ type, cards, deckId, isOwner, onCardClick }: TypeGroupProps) {
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
            onCardClick={onCardClick}
          />
        ))}
      </div>
    </section>
  )
}

// ─── DeckCardGrid ─────────────────────────────────────────────────────────────

export function DeckCardGrid({ deckId, cards, isOwner }: DeckCardGridProps) {
  const [selectedCard, setSelectedCard] = useState<DeckCardEntry | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  function handleCardClick(card: DeckCardEntry) {
    setSelectedCard(card)
    setModalOpen(true)
  }

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
    <>
      <div className="flex flex-col gap-8">
        {[...sortedTypes, ...extraTypes].map((type) => (
          <TypeGroup
            key={type}
            type={type}
            cards={grouped.get(type)!}
            deckId={deckId}
            isOwner={isOwner}
            onCardClick={handleCardClick}
          />
        ))}
      </div>

      {selectedCard && (
        <CardDetailModal
          card={{
            id: selectedCard.cardId,
            name: selectedCard.name,
            manaCost: selectedCard.manaCost,
            typeLine: selectedCard.typeLine ?? '',
            oracleText: selectedCard.oracleText ?? null,
            power: selectedCard.power ?? null,
            toughness: selectedCard.toughness ?? null,
            rarity: selectedCard.rarity ?? 'common',
            setCode: selectedCard.setCode ?? '',
            imageUris: selectedCard.imageUris,
            cardFaces: selectedCard.cardFaces,
            prices: selectedCard.prices ?? null,
          }}
          open={modalOpen}
          onOpenChange={setModalOpen}
        />
      )}
    </>
  )
}
