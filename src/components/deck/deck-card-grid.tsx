'use client'

import { useState, useRef, useTransition, useCallback, useOptimistic } from 'react'
import { ArrowUpDown, MoreVertical, Check } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { CardImage } from '@/components/cards/card-image'
import { CardDetailModal } from '@/components/cards/card-detail-modal'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuSub,
} from '@/components/ui/dropdown-menu'
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
  availableCategories?: string[]
  groupBy?: 'type' | 'role' | 'cmc'
  cardSize?: number
  legalityIssues?: LegalityIssue[]
  pushUndo?: (action: UndoAction) => void
  onCategoryChange?: (deckCardId: string, categories: string[]) => void
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

// ─── Category API helper ─────────────────────────────────────────────────────

async function updateCardCategories(
  deckId: string,
  deckCardId: string,
  categories: string[],
  action: 'set' | 'add' | 'remove',
): Promise<string[]> {
  const res = await fetch(`/api/decks/${deckId}/card-categories`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deckCardId, categories, action }),
  })
  if (!res.ok) throw new Error('Failed to update categories')
  const data = await res.json()
  return (data.categories ?? []).map((c: { category: string }) => c.category)
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
  availableCategories?: string[]
  onCategoryChange?: (deckCardId: string, categories: string[]) => void
  // DnD
  isDragging?: boolean
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

function CardThumb({
  card,
  deckId,
  isOwner,
  onCardClick,
  roles,
  cardSize,
  legalityIssue,
  pushUndo,
  availableCategories,
  onCategoryChange,
  isDragging,
  dragHandleProps,
}: CardThumbProps) {
  const [hovered, setHovered] = useState(false)
  const [removing, startRemove] = useTransition()
  const [toggling, startToggle] = useTransition()
  const [updatingQty, startUpdateQty] = useTransition()
  const [updatingCategory, startCategoryUpdate] = useTransition()

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

  const imageSize: 'small' | 'normal' | 'large' =
    width >= 300 ? 'large' : width >= 200 ? 'normal' : 'small'

  function handleRemove() {
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
    if (preDebounceQtyRef.current === null) {
      preDebounceQtyRef.current = localQty
    }
    const next = localQty + 1
    setLocalQty(next)
    debouncedUpdate(next)
  }

  function handleDecrease() {
    if (localQty <= 1) {
      pushUndo?.({ type: 'remove', deckId, cardId: card.cardId, cardName: card.name, quantity: card.quantity ?? 1 })
      startRemove(async () => {
        await removeCardFromDeck(deckId, card.deckCardId)
      })
      return
    }
    if (preDebounceQtyRef.current === null) {
      preDebounceQtyRef.current = localQty
    }
    const next = localQty - 1
    setLocalQty(next)
    debouncedUpdate(next)
  }

  // ── Role toggle ───────────────────────────────────────────────────────────
  function handleToggleRole(role: string) {
    const currentRoles = roles ?? []
    const hasRole = currentRoles.includes(role)

    startCategoryUpdate(async () => {
      try {
        const updated = await updateCardCategories(
          deckId,
          card.deckCardId,
          [role],
          hasRole ? 'remove' : 'add',
        )
        onCategoryChange?.(card.deckCardId, updated)
      } catch {
        // silently ignore — optimistic update will revert on next data load
      }
    })
  }

  // Determine visible categories for submenu
  const allCategories = availableCategories && availableCategories.length > 0
    ? availableCategories
    : ROLE_ORDER

  const visibleRoles = roles?.slice(0, 2) ?? []
  const extraRoleCount = (roles?.length ?? 0) - visibleRoles.length

  return (
    <div
      className={cn(
        'relative group flex flex-col items-center gap-1',
        isDragging && 'opacity-40',
      )}
      style={{ width }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...dragHandleProps}
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
              legalityIssue && 'ring-2 ring-warning ring-offset-1 ring-offset-background',
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

        {/* Hover overlay: action buttons (remove + sideboard toggle) — top-left */}
        {isOwner && hovered && !card.isCommander && (
          <div className="absolute -top-1.5 -left-1.5 z-20 flex flex-col gap-1">
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

        {/* Ellipsis menu — shown on hover for owners */}
        {isOwner && hovered && (
          <div
            className="absolute top-1 right-1 z-30"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  'size-6 rounded-full',
                  'bg-black/60 backdrop-blur-sm text-white',
                  'flex items-center justify-center',
                  'shadow-md border border-white/10',
                  'transition-all duration-150',
                  'hover:bg-black/80',
                  card.isCommander && '-top-1.5 -right-1.5',
                )}
                aria-label="Card options"
              >
                <MoreVertical className="size-3.5" />
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" sideOffset={4}>
                {/* Assign Role submenu */}
                <DropdownMenuSub
                  trigger={
                    <span className="flex items-center gap-2 text-sm">
                      Assign Role
                    </span>
                  }
                >
                  <DropdownMenuLabel>Roles</DropdownMenuLabel>
                  {allCategories.map((cat) => {
                    const isAssigned = (roles ?? []).includes(cat)
                    const label = ROLE_LABELS[cat] ?? cat.charAt(0).toUpperCase() + cat.slice(1).replace(/-/g, ' ')
                    return (
                      <DropdownMenuItem
                        key={cat}
                        onClick={() => handleToggleRole(cat)}
                        className={cn(updatingCategory && 'opacity-50 pointer-events-none')}
                      >
                        <Check
                          className={cn(
                            'size-3.5 shrink-0',
                            isAssigned ? 'opacity-100 text-primary' : 'opacity-0',
                          )}
                        />
                        {label}
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuSub>

                <DropdownMenuSeparator />

                {/* Sideboard toggle */}
                <DropdownMenuItem onClick={handleToggleSideboard} disabled={toggling || card.isCommander}>
                  <ArrowUpDown className="size-3.5 shrink-0 text-muted-foreground" />
                  {card.isSideboard ? 'Move to Main' : 'Move to Sideboard'}
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {/* Remove */}
                <DropdownMenuItem
                  onClick={handleRemove}
                  disabled={removing || card.isCommander}
                  className="text-destructive hover:text-destructive focus:text-destructive"
                >
                  <span className="size-3.5 shrink-0 flex items-center justify-center font-bold text-xs">×</span>
                  Remove from Deck
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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

        {/* Quantity badge — shown when quantity > 1 and not hovered */}
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

// ─── Draggable card wrapper ───────────────────────────────────────────────────

interface DraggableCardProps {
  card: DeckCardEntry
  deckId: string
  isOwner: boolean
  onCardClick: (card: DeckCardEntry) => void
  roles?: string[]
  cardSize?: number
  legalityIssue?: LegalityIssue
  pushUndo?: (action: UndoAction) => void
  availableCategories?: string[]
  onCategoryChange?: (deckCardId: string, categories: string[]) => void
}

function DraggableCard(props: DraggableCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: props.card.deckCardId,
    data: { card: props.card },
  })

  return (
    <div
      ref={setNodeRef}
      style={{ touchAction: 'none' }}
      className={cn(isDragging && 'cursor-grabbing')}
    >
      <CardThumb
        {...props}
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners, style: { cursor: isDragging ? 'grabbing' : 'grab' } }}
      />
    </div>
  )
}

// ─── Droppable role section ───────────────────────────────────────────────────

interface DroppableRoleGroupProps {
  roleKey: string
  label: string
  cards: DeckCardEntry[]
  deckId: string
  isOwner: boolean
  onCardClick: (card: DeckCardEntry) => void
  cardRoles?: Record<string, string[]>
  cardSize?: number
  legalityIssues?: LegalityIssue[]
  pushUndo?: (action: UndoAction) => void
  availableCategories?: string[]
  onCategoryChange?: (deckCardId: string, categories: string[]) => void
  isDropTarget: boolean
}

function DroppableRoleGroup({
  roleKey,
  label,
  cards,
  deckId,
  isOwner,
  onCardClick,
  cardRoles,
  cardSize,
  legalityIssues,
  pushUndo,
  availableCategories,
  onCategoryChange,
  isDropTarget,
}: DroppableRoleGroupProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `role:${roleKey}` })

  const count = cards.reduce((sum, c) => sum + (c.quantity ?? 1), 0)

  return (
    <section ref={setNodeRef}>
      <div
        className={cn(
          'flex items-center gap-2 mb-3 pb-2 border-b transition-colors duration-150',
          isOver ? 'border-primary/60' : 'border-divider',
        )}
      >
        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
        <span className="text-xs text-muted-foreground tabular-nums">({count})</span>
        {isDropTarget && (
          <span className="ml-auto text-xs text-muted-foreground/60 italic">drop to assign role</span>
        )}
      </div>

      <div
        className={cn(
          'flex flex-wrap gap-3 min-h-[3rem] rounded-lg p-1 -m-1 transition-colors duration-150',
          isOver && 'bg-primary/5 ring-1 ring-primary/20',
        )}
      >
        {cards.map((card) => (
          <DraggableCard
            key={card.deckCardId}
            card={card}
            deckId={deckId}
            isOwner={isOwner}
            onCardClick={onCardClick}
            roles={cardRoles?.[card.name]}
            cardSize={cardSize}
            legalityIssue={legalityIssues?.find((issue) => issue.cardId === card.cardId)}
            pushUndo={pushUndo}
            availableCategories={availableCategories}
            onCategoryChange={onCategoryChange}
          />
        ))}
      </div>
    </section>
  )
}

// ─── Card group (for non-role groupings — type/cmc) ──────────────────────────

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
  availableCategories?: string[]
  onCategoryChange?: (deckCardId: string, categories: string[]) => void
}

function CardGroup({
  label,
  cards,
  deckId,
  isOwner,
  onCardClick,
  cardRoles,
  cardSize,
  legalityIssues,
  pushUndo,
  availableCategories,
  onCategoryChange,
}: CardGroupProps) {
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
            availableCategories={availableCategories}
            onCategoryChange={onCategoryChange}
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

export function DeckCardGrid({
  deckId,
  cards,
  isOwner,
  cardRoles: externalCardRoles,
  availableCategories,
  groupBy = 'type',
  cardSize,
  legalityIssues,
  pushUndo,
  onCategoryChange,
}: DeckCardGridProps) {
  const [selectedCard, setSelectedCard] = useState<DeckCardEntry | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [, startTransition] = useTransition()

  // ── Optimistic card roles (for DnD drops and menu toggles) ────────────────
  const [optimisticRoles, setOptimisticRoles] = useOptimistic(
    externalCardRoles ?? {},
    (current, update: { cardName: string; roles: string[] }) => ({
      ...current,
      [update.cardName]: update.roles,
    }),
  )

  // ── DnD state ─────────────────────────────────────────────────────────────
  const [activeCard, setActiveCard] = useState<DeckCardEntry | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        // Require 8px movement before drag starts — prevents accidental drags on click
        distance: 8,
      },
    }),
  )

  function handleDragStart(event: DragStartEvent) {
    const card = event.active.data.current?.card as DeckCardEntry | undefined
    if (card) setActiveCard(card)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null)

    const { over, active } = event
    if (!over) return

    const targetId = over.id as string
    if (!targetId.startsWith('role:')) return

    const targetRole = targetId.replace('role:', '')
    const card = active.data.current?.card as DeckCardEntry | undefined
    if (!card) return

    const currentRoles = optimisticRoles[card.name] ?? []
    // If already in this role as primary, no-op
    if (currentRoles[0] === targetRole) return

    // Set this role as the primary (first) role
    const otherRoles = currentRoles.filter((r) => r !== targetRole)
    const newRoles = [targetRole, ...otherRoles]

    // Optimistic update
    startTransition(async () => {
      setOptimisticRoles({ cardName: card.name, roles: newRoles })

      try {
        const updated = await updateCardCategories(deckId, card.deckCardId, [targetRole], 'set')
        onCategoryChange?.(card.deckCardId, updated)
      } catch {
        // Optimistic update will revert when external data re-renders
      }
    })
  }

  // Merge optimistic roles with external for category-change callback
  const cardRoles = optimisticRoles

  const handleCategoryChange = useCallback(
    (deckCardId: string, categories: string[]) => {
      // Find the card name for this deckCardId
      const card = cards.find((c) => c.deckCardId === deckCardId)
      if (card) {
        startTransition(() => {
          setOptimisticRoles({ cardName: card.name, roles: categories })
        })
      }
      onCategoryChange?.(deckCardId, categories)
    },
    [cards, onCategoryChange, setOptimisticRoles],
  )

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

  // Separate commander from the 99
  const commanderCards = cards.filter(c => c.isCommander)
  const deckCards = cards.filter(c => !c.isCommander)

  // Compute groups based on groupBy mode
  let groups: { key: string; label: string; cards: DeckCardEntry[] }[]
  switch (groupBy) {
    case 'role':
      groups = groupByRole(deckCards, cardRoles)
      break
    case 'cmc':
      groups = groupByCmc(deckCards)
      break
    case 'type':
    default:
      groups = groupByType(deckCards)
      break
  }

  const isRoleMode = groupBy === 'role'

  // Derive available categories from ROLE_ORDER + any extras in cardRoles + availableCategories prop
  const allAvailableCategories = [
    ...ROLE_ORDER,
    ...(availableCategories ?? []).filter((c) => !ROLE_ORDER.includes(c)),
    ...Object.values(cardRoles)
      .flat()
      .filter((r) => !ROLE_ORDER.includes(r)),
  ].filter((v, i, arr) => arr.indexOf(v) === i) // deduplicate

  const gridContent = (
    <div className="flex flex-col gap-8">
      {/* Commander Section */}
      {commanderCards.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
              <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
              Commander
            </span>
          </div>
          <div className="flex gap-4">
            {commanderCards.map((card) => (
              <div
                key={card.deckCardId}
                className="rounded-xl ring-2 ring-amber-500/40 ring-offset-2 ring-offset-background"
              >
                <CardThumb
                  card={card}
                  deckId={deckId}
                  isOwner={isOwner}
                  onCardClick={handleCardClick}
                  cardSize={cardSize}
                  legalityIssue={legalityIssues?.find(l => l.deckCardId === card.deckCardId)}
                  pushUndo={pushUndo}
                  availableCategories={allAvailableCategories}
                  onCategoryChange={handleCategoryChange}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Card Groups */}
      {isRoleMode
        ? groups.map((group) => (
            <DroppableRoleGroup
              key={group.key}
              roleKey={group.key}
              label={group.label}
              cards={group.cards}
              deckId={deckId}
              isOwner={isOwner}
              onCardClick={handleCardClick}
              cardRoles={cardRoles}
              cardSize={cardSize}
              legalityIssues={legalityIssues}
              pushUndo={pushUndo}
              availableCategories={allAvailableCategories}
              onCategoryChange={handleCategoryChange}
              isDropTarget={activeCard !== null}
            />
          ))
        : groups.map((group) => (
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
              availableCategories={allAvailableCategories}
              onCategoryChange={handleCategoryChange}
            />
          ))}
    </div>
  )

  return (
    <>
      {isRoleMode ? (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {gridContent}

          {/* Drag overlay — ghost of the dragged card */}
          <DragOverlay dropAnimation={null}>
            {activeCard && (
              <div className="pointer-events-none rotate-2 opacity-90 shadow-2xl">
                <CardThumb
                  card={activeCard}
                  deckId={deckId}
                  isOwner={false}
                  onCardClick={() => {}}
                  roles={cardRoles[activeCard.name]}
                  cardSize={cardSize}
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        gridContent
      )}

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
