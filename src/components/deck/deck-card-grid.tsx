'use client'

import { useState, useRef, useTransition } from 'react'
import { ArrowUpDown } from 'lucide-react'
import { CardImage } from '@/components/cards/card-image'
import { CardDetailModal } from '@/components/cards/card-detail-modal'
import { cn } from '@/lib/utils'
import type { CardImageUris, CardFace } from '@/types/card'
import { removeCardFromDeck, toggleSideboard, updateCardQuantity } from '@/app/(dashboard)/decks/actions'
import type { UndoAction } from '@/hooks/use-deck-undo'

// ─── Unlimited-copy cards (mirrors server-side list) ─────────────────────────

const UNLIMITED_COPIES = new Set([
  'Plains', 'Island', 'Swamp', 'Mountain', 'Forest',
  'Snow-Covered Plains', 'Snow-Covered Island', 'Snow-Covered Swamp',
  'Snow-Covered Mountain', 'Snow-Covered Forest',
  'Wastes',
  'Relentless Rats', 'Rat Colony', 'Shadowborn Apostle',
  "Dragon's Approach", 'Persistent Petitioners', 'Seven Dwarves',
  'Slime Against Humanity', 'Hare Apparent',
])

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeckCardEntry {
  deckCardId: string
  cardId: string
  name: string
  cardType: string
  isCommander: boolean
  isSideboard: boolean
  quantity?: number
  imageUris: CardImageUris | null
  cardFaces: CardFace[] | null
  manaCost: string | null
  cmc: number
  userNote: string | null
  // Additional fields for detail modal
  typeLine?: string | null
  oracleText?: string | null
  power?: string | null
  toughness?: string | null
  rarity?: string | null
  setCode?: string | null
  prices?: Record<string, string | null> | null
}

export interface LegalityIssue {
  cardId: string
  cardName: string
  deckCardId: string
  type: 'color_identity' | 'banned' | 'not_legal' | 'over_limit'
  message: string
}

export interface DeckCardGridProps {
  deckId: string
  cards: DeckCardEntry[]
  isOwner: boolean
  cardRoles?: Record<string, string[]>
  groupBy?: 'type' | 'role' | 'cmc'
  cardSize?: number
  legalityIssues?: LegalityIssue[]
  pushUndo?: (action: UndoAction) => void
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
  legalityIssue?: LegalityIssue
  pushUndo?: (action: UndoAction) => void
}

function CardThumb({ card, deckId, isOwner, onCardClick, roles, cardSize, legalityIssue, pushUndo }: CardThumbProps) {
  const [hovered, setHovered] = useState(false)
  const [removing, startRemove] = useTransition()
  const [toggling, startToggle] = useTransition()
  const [updatingQty, startUpdateQty] = useTransition()

  // ── Debounced quantity ────────────────────────────────────────────────────
  const serverQty = card.quantity ?? 1
  const [localQty, setLocalQty] = useState(serverQty)
  const [prevServerQty, setPrevServerQty] = useState(serverQty)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const preDebounceQtyRef = useRef<number | null>(null)

  // React-recommended pattern: sync state from props during render (no useEffect)
  if (serverQty !== prevServerQty) {
    setPrevServerQty(serverQty)
    setLocalQty(serverQty)
  }

  function debouncedUpdate(qty: number) {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      // Push undo for the entire batch (from pre-debounce to final qty)
      if (pushUndo && preDebounceQtyRef.current !== null) {
        pushUndo({ type: 'quantity', deckCardId: card.deckCardId, previousQuantity: preDebounceQtyRef.current })
        preDebounceQtyRef.current = null
      }
      startUpdateQty(() => {
        updateCardQuantity(card.deckCardId, qty)
      })
    }, 600)
  }

  const width = cardSize ?? 146

  // Map numeric width to the nearest CardImage size variant
  const imageSize: 'small' | 'normal' | 'large' =
    width >= 300 ? 'large' : width >= 200 ? 'normal' : 'small'

  function handleRemove() {
    // Push undo before removing
    pushUndo?.({ type: 'remove', deckId, cardId: card.cardId, cardName: card.name, quantity: card.quantity ?? 1 })
    startRemove(async () => {
      await removeCardFromDeck(deckId, card.deckCardId)
    })
  }

  function handleToggleSideboard() {
    startToggle(async () => {
      await toggleSideboard(deckId, card.deckCardId)
    })
  }

  function handleIncrease() {
    // Track the quantity before the first click in a debounce batch
    if (preDebounceQtyRef.current === null) {
      preDebounceQtyRef.current = localQty
    }
    const next = localQty + 1
    setLocalQty(next)
    debouncedUpdate(next)
  }

  function handleDecrease() {
    if (localQty <= 1) {
      // Remove card immediately (no debounce)
      pushUndo?.({ type: 'remove', deckId, cardId: card.cardId, cardName: card.name, quantity: card.quantity ?? 1 })
      startRemove(async () => {
        await removeCardFromDeck(deckId, card.deckCardId)
      })
      return
    }
    // Track the quantity before the first click in a debounce batch
    if (preDebounceQtyRef.current === null) {
      preDebounceQtyRef.current = localQty
    }
    const next = localQty - 1
    setLocalQty(next)
    debouncedUpdate(next)
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
        <div
          style={{ width, height: Math.round(width * 1.395), overflow: 'hidden', borderRadius: '4.75% / 3.4%' }}
          className={cn(
            'transition-all duration-200 shadow-sm',
            hovered && 'ring-1 ring-border shadow-md',
          )}
        >
          <CardImage
            name={card.name}
            imageUris={card.imageUris}
            cardFaces={card.cardFaces}
            size={imageSize}
            className={cn(
              'transition-transform duration-200 !w-full !h-full',
              hovered && 'scale-[1.02]',
              (removing || toggling) && 'opacity-50',
            )}
          />
        </div>
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
          <div className="absolute -bottom-1.5 -left-1.5 z-20 px-1 py-0.5 rounded-sm bg-interactive text-interactive-foreground text-[8px] font-bold uppercase tracking-wide shadow">
            SB
          </div>
        )}

        {/* Quantity badge — shown when quantity > 1 and not hovered (hovered shows the controls instead) */}
        {localQty > 1 && !hovered && (
          <div className="absolute bottom-1 right-1 z-20 bg-foreground text-background rounded-full text-2xs font-bold px-1.5 py-0.5 leading-none shadow">
            ×{localQty}
          </div>
        )}

        {/* Quantity controls — shown on hover for owner non-commander cards */}
        {isOwner && hovered && !card.isCommander && (
          <div className="absolute bottom-0 inset-x-0 z-20 bg-black/70 backdrop-blur-sm flex items-center justify-center gap-2 py-1.5 rounded-b-[4.75%]">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleDecrease() }}
              disabled={removing || updatingQty}
              className={cn(
                'size-6 rounded-full flex items-center justify-center',
                'bg-white/20 hover:bg-red-500/70 text-white',
                'text-sm font-bold leading-none',
                'transition-colors duration-150',
                'disabled:opacity-40',
              )}
              aria-label={`Decrease quantity of ${card.name}`}
            >
              −
            </button>
            <span className="text-white text-sm font-bold tabular-nums min-w-[1.5ch] text-center select-none">
              {localQty}
            </span>
            {UNLIMITED_COPIES.has(card.name) && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleIncrease() }}
                disabled={updatingQty}
                className={cn(
                  'size-6 rounded-full flex items-center justify-center',
                  'bg-white/20 hover:bg-green-500/70 text-white',
                  'text-sm font-bold leading-none',
                  'transition-colors duration-150',
                  'disabled:opacity-40',
                )}
                aria-label={`Increase quantity of ${card.name}`}
              >
                +
              </button>
            )}
          </div>
        )}

        {/* Legality warning indicator */}
        {legalityIssue && (
          <div
            title={legalityIssue.message}
            className={cn(
              'absolute top-1 left-1 z-20',
              'size-5 rounded-full',
              'bg-warning text-warning-foreground',
              'flex items-center justify-center',
              'shadow-md border border-background',
              'text-xs leading-none select-none',
              'cursor-help',
            )}
            aria-label={`Legality issue: ${legalityIssue.message}`}
          >
            ⚠
          </div>
        )}
      </div>

      {/* Card name */}
      <span
        className="text-2xs text-center text-muted-foreground leading-tight truncate"
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
              className="text-2xs rounded-full bg-muted text-muted-foreground px-1.5 leading-relaxed"
            >
              {abbreviateRole(role)}
            </span>
          ))}
          {extraRoleCount > 0 && (
            <span className="text-2xs text-muted-foreground/60">
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
  legalityIssues?: LegalityIssue[]
  pushUndo?: (action: UndoAction) => void
}

function CardGroup({ label, cards, deckId, isOwner, onCardClick, cardRoles, cardSize, legalityIssues, pushUndo }: CardGroupProps) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-divider">
        <h3 className="text-sm font-semibold text-foreground">
          {label}
        </h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          ({cards.reduce((sum, c) => sum + (c.quantity ?? 1), 0)})
        </span>
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
            legalityIssue={legalityIssues?.find((issue) => issue.cardId === card.cardId)}
            pushUndo={pushUndo}
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

export function DeckCardGrid({ deckId, cards, isOwner, cardRoles, groupBy = 'type', cardSize, legalityIssues, pushUndo }: DeckCardGridProps) {
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
            legalityIssues={legalityIssues}
            pushUndo={pushUndo}
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
          userNote={selectedCard?.userNote ?? undefined}
          isOwner={isOwner}
          isCommander={selectedCard.isCommander}
          onRemove={(id) => {
            if (selectedCard && pushUndo) {
              pushUndo({ type: 'remove', deckId, cardId: selectedCard.cardId, cardName: selectedCard.name, quantity: selectedCard.quantity ?? 1 })
            }
            startTransition(() => removeCardFromDeck(deckId, id))
            setSelectedCard(null)
            setModalOpen(false)
          }}
        />
      )}
    </>
  )
}
