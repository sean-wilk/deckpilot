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
  cardRoles?: Record<string, string[]>
  groupBy?: 'type' | 'role' | 'cmc'
  cardSize?: number
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

// ─── Role ordering & display ─────────────────────────────────────────────────

const ROLE_ORDER = [
  'ramp',
  'card-draw',
  'targeted-removal',
  'board-wipes',
  'win-con',
  'protection',
]

const ROLE_LABELS: Record<string, string> = {
  'ramp':              'Ramp',
  'card-draw':         'Card Draw',
  'targeted-removal':  'Targeted Removal',
  'board-wipes':       'Board Wipes',
  'win-con':           'Win Conditions',
  'protection':        'Protection',
}

// ─── Role abbreviation ──────────────────────────────────────────────────────

function abbreviateRole(role: string): string {
  const abbrevMap: Record<string, string> = {
    'targeted-removal': 'removal',
    'board-wipes': 'wipe',
    'card-draw': 'draw',
    'win-con': 'wincon',
    'protection': 'protect',
  }
  return abbrevMap[role] ?? role
}

// ─── Card thumbnail ────────────────────────────────────────────────────────────

interface CardThumbProps {
  card: DeckCardEntry
  deckId: string
  isOwner: boolean
  onCardClick: (card: DeckCardEntry) => void
  roles?: string[]
  cardSize?: number
}

function CardThumb({ card, deckId, isOwner, onCardClick, roles, cardSize }: CardThumbProps) {
  const [hovered, setHovered] = useState(false)
  const [removing, startRemove] = useTransition()
  const [toggling, startToggle] = useTransition()

  const width = cardSize ?? 146

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

  const visibleRoles = roles?.slice(0, 2) ?? []
  const extraRoleCount = (roles?.length ?? 0) - visibleRoles.length

  return (
    <div
      className="relative group flex flex-col items-center gap-1"
      style={{ width }}
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
      <span
        className="text-[10px] text-center text-muted-foreground leading-tight truncate"
        style={{ maxWidth: Math.max(width - 8, 60) }}
      >
        {card.name}
      </span>

      {/* Role tag pills */}
      {visibleRoles.length > 0 && (
        <div className="flex items-center gap-0.5 flex-wrap justify-center">
          {visibleRoles.map((role) => (
            <span
              key={role}
              className="text-[9px] rounded-full bg-muted text-muted-foreground px-1.5 leading-relaxed"
            >
              {abbreviateRole(role)}
            </span>
          ))}
          {extraRoleCount > 0 && (
            <span className="text-[9px] text-muted-foreground/60">
              +{extraRoleCount}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Card group (generic for type / role / cmc) ──────────────────────────────

interface CardGroupProps {
  label: string
  cards: DeckCardEntry[]
  deckId: string
  isOwner: boolean
  onCardClick: (card: DeckCardEntry) => void
  cardRoles?: Record<string, string[]>
  cardSize?: number
}

function CardGroup({ label, cards, deckId, isOwner, onCardClick, cardRoles, cardSize }: CardGroupProps) {
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
            roles={cardRoles?.[card.name]}
            cardSize={cardSize}
          />
        ))}
      </div>
    </section>
  )
}

// ─── Grouping helpers ────────────────────────────────────────────────────────

function groupByType(cards: DeckCardEntry[]): { key: string; label: string; cards: DeckCardEntry[] }[] {
  const grouped = new Map<string, DeckCardEntry[]>()
  for (const card of cards) {
    const key = card.cardType ?? 'other'
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(card)
  }

  const sortedTypes = TYPE_ORDER.filter((t) => grouped.has(t))
  const extraTypes = [...grouped.keys()].filter((t) => !TYPE_ORDER.includes(t))

  return [...sortedTypes, ...extraTypes].map((type) => ({
    key: type,
    label: TYPE_LABELS[type] ?? type.charAt(0).toUpperCase() + type.slice(1),
    cards: grouped.get(type)!,
  }))
}

function groupByRole(
  cards: DeckCardEntry[],
  cardRoles: Record<string, string[]>,
): { key: string; label: string; cards: DeckCardEntry[] }[] {
  const grouped = new Map<string, DeckCardEntry[]>()

  for (const card of cards) {
    const roles = cardRoles[card.name]
    const primaryRole = roles?.[0] ?? 'unassigned'
    if (!grouped.has(primaryRole)) grouped.set(primaryRole, [])
    grouped.get(primaryRole)!.push(card)
  }

  // Ordered roles first, then alphabetical extras, then unassigned last
  const orderedKeys = ROLE_ORDER.filter((r) => grouped.has(r))
  const extraKeys = [...grouped.keys()]
    .filter((r) => r !== 'unassigned' && !ROLE_ORDER.includes(r))
    .sort()
  if (grouped.has('unassigned')) {
    extraKeys.push('unassigned')
  }

  return [...orderedKeys, ...extraKeys].map((role) => ({
    key: role,
    label:
      role === 'unassigned'
        ? 'Unassigned'
        : ROLE_LABELS[role] ?? role.charAt(0).toUpperCase() + role.slice(1).replace(/-/g, ' '),
    cards: grouped.get(role)!,
  }))
}

function groupByCmc(cards: DeckCardEntry[]): { key: string; label: string; cards: DeckCardEntry[] }[] {
  const grouped = new Map<string, DeckCardEntry[]>()

  for (const card of cards) {
    const bucket = card.cmc >= 7 ? '7+' : String(Math.floor(card.cmc))
    if (!grouped.has(bucket)) grouped.set(bucket, [])
    grouped.get(bucket)!.push(card)
  }

  const cmcOrder = ['0', '1', '2', '3', '4', '5', '6', '7+']
  const sortedKeys = cmcOrder.filter((k) => grouped.has(k))

  return sortedKeys.map((bucket) => ({
    key: bucket,
    label: `CMC ${bucket}`,
    cards: grouped.get(bucket)!,
  }))
}

// ─── DeckCardGrid ─────────────────────────────────────────────────────────────

export function DeckCardGrid({ deckId, cards, isOwner, cardRoles, groupBy = 'type', cardSize }: DeckCardGridProps) {
  const [selectedCard, setSelectedCard] = useState<DeckCardEntry | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [, startTransition] = useTransition()

  function handleCardClick(card: DeckCardEntry) {
    setSelectedCard(card)
    setModalOpen(true)
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-4xl mb-3">🃏</div>
        <p className="text-sm font-medium text-muted-foreground">No cards yet</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Search for cards above to build your deck</p>
      </div>
    )
  }

  // Compute groups based on groupBy mode
  let groups: { key: string; label: string; cards: DeckCardEntry[] }[]
  switch (groupBy) {
    case 'role':
      groups = groupByRole(cards, cardRoles ?? {})
      break
    case 'cmc':
      groups = groupByCmc(cards)
      break
    case 'type':
    default:
      groups = groupByType(cards)
      break
  }

  return (
    <>
      <div className="flex flex-col gap-8">
        {groups.map((group) => (
          <CardGroup
            key={group.key}
            label={group.label}
            cards={group.cards}
            deckId={deckId}
            isOwner={isOwner}
            onCardClick={handleCardClick}
            cardRoles={cardRoles}
            cardSize={cardSize}
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
          deckId={deckId}
          deckCardId={selectedCard.deckCardId}
          isOwner={isOwner}
          isCommander={selectedCard.isCommander}
          onRemove={(id) => {
            startTransition(() => removeCardFromDeck(deckId, id))
            setSelectedCard(null)
            setModalOpen(false)
          }}
        />
      )}
    </>
  )
}
