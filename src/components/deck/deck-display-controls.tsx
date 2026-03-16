'use client'

import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeckDisplayControlsProps {
  groupBy: 'type' | 'role' | 'cmc'
  onGroupByChange: (value: 'type' | 'role' | 'cmc') => void
  cardSize: number
  onCardSizeChange: (size: number) => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CARD_SIZE_MIN = 72
const CARD_SIZE_MAX = 350
const CARD_SIZE_DEFAULT = 100
const CARD_SIZE_STORAGE_KEY = 'deckpilot:card-size'

const GROUP_OPTIONS = [
  { value: 'type', label: 'Type' },
  { value: 'role', label: 'Role' },
  { value: 'cmc',  label: 'CMC'  },
] as const

function getSizeLabel(size: number): string {
  if (size <= 90)  return 'S'
  if (size <= 130) return 'M'
  return 'L'
}

// ─── DeckDisplayControls ──────────────────────────────────────────────────────

export function DeckDisplayControls({
  groupBy,
  onGroupByChange,
  cardSize,
  onCardSizeChange,
}: DeckDisplayControlsProps) {

  function handleSizeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const size = Number(e.target.value)
    onCardSizeChange(size)
    try {
      localStorage.setItem(CARD_SIZE_STORAGE_KEY, String(size))
    } catch {
      // localStorage may be unavailable in SSR or private browsing
    }
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 px-4 py-2',
        'border-b bg-background/95 backdrop-blur-sm',
      )}
    >
      {/* Left: grouping segmented control */}
      <div
        role="group"
        aria-label="Group cards by"
        className={cn(
          'flex items-center gap-0.5',
          'rounded-md border border-border bg-muted/50 p-0.5',
        )}
      >
        {GROUP_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => onGroupByChange(value)}
            aria-pressed={groupBy === value}
            className={cn(
              'px-3 py-1 rounded text-xs font-medium leading-none',
              'transition-all duration-150',
              groupBy === value
                ? 'bg-background text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Right: card size slider */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground leading-none select-none">
          Size
        </span>
        <input
          type="range"
          min={CARD_SIZE_MIN}
          max={CARD_SIZE_MAX}
          value={cardSize}
          onChange={handleSizeChange}
          aria-label="Card size"
          className="w-20 h-1 accent-foreground cursor-pointer"
        />
        <span
          className={cn(
            'w-5 text-center text-xs font-semibold tabular-nums text-foreground leading-none select-none',
          )}
          aria-live="polite"
          aria-label={`Card size: ${getSizeLabel(cardSize)}`}
        >
          {getSizeLabel(cardSize)}
        </span>
      </div>
    </div>
  )
}

// ─── Default size helper (for consumers to initialise from localStorage) ──────

export function getInitialCardSize(): number {
  if (typeof window === 'undefined') return CARD_SIZE_DEFAULT
  try {
    const stored = localStorage.getItem(CARD_SIZE_STORAGE_KEY)
    if (stored) {
      const parsed = Number(stored)
      if (!isNaN(parsed) && parsed >= CARD_SIZE_MIN && parsed <= CARD_SIZE_MAX) {
        return parsed
      }
    }
  } catch {
    // ignore
  }
  return CARD_SIZE_DEFAULT
}
