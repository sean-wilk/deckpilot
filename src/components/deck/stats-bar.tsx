'use client'

import { cn } from '@/lib/utils'
import { BRACKET_LABELS, BRACKET_BADGE_COLORS } from '@/lib/constants/brackets'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatsCard {
  cmc: number | string | null
  colors: string[]
  prices: Record<string, string | null> | null
}

export interface StatsBarProps {
  cards: StatsCard[]
  deckName: string
  targetBracket: number
  className?: string
}

// ─── MTG color config ─────────────────────────────────────────────────────────

const MTG_COLORS = [
  { symbol: 'W', label: 'White', bg: 'bg-amber-200',   border: 'border-amber-400',   text: 'text-amber-900' },
  { symbol: 'U', label: 'Blue',  bg: 'bg-blue-400',    border: 'border-blue-600',    text: 'text-white'     },
  { symbol: 'B', label: 'Black', bg: 'bg-slate-700',   border: 'border-slate-900',   text: 'text-slate-100' },
  { symbol: 'R', label: 'Red',   bg: 'bg-red-500',     border: 'border-red-700',     text: 'text-white'     },
  { symbol: 'G', label: 'Green', bg: 'bg-green-600',   border: 'border-green-800',   text: 'text-white'     },
] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeAvgCmc(cards: StatsCard[]): string {
  const nonLands = cards.filter((c) => {
    const cmc = typeof c.cmc === 'string' ? parseFloat(c.cmc) : (c.cmc ?? 0)
    return cmc > 0
  })
  if (!nonLands.length) return '0.00'
  const total = nonLands.reduce((sum, c) => {
    return sum + (typeof c.cmc === 'string' ? parseFloat(c.cmc) : (c.cmc ?? 0))
  }, 0)
  return (total / nonLands.length).toFixed(2)
}

function computeColorCounts(cards: StatsCard[]): Record<string, number> {
  const counts: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 }
  for (const card of cards) {
    for (const color of card.colors) {
      if (color in counts) counts[color]++
    }
  }
  return counts
}

function computeTotalPrice(cards: StatsCard[]): string {
  let total = 0
  for (const card of cards) {
    const usd = card.prices?.usd ?? card.prices?.usd_foil ?? null
    if (usd) total += parseFloat(usd)
  }
  return total.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

// ─── Stat Cell ────────────────────────────────────────────────────────────────

function StatCell({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-0.5 px-3', className)}>
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground leading-none">
        {label}
      </span>
      <span className="text-sm font-semibold tabular-nums text-foreground leading-tight">
        {value}
      </span>
    </div>
  )
}

// ─── Color pip ────────────────────────────────────────────────────────────────

function ColorPip({
  symbol,
  bg,
  border,
  text,
  label,
  count,
  total,
}: {
  symbol: string
  bg: string
  border: string
  text: string
  label: string
  count: number
  total: number
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex flex-col items-center gap-1 min-w-[36px]">
      <div
        className={cn(
          'size-6 rounded-full flex items-center justify-center',
          'border text-[10px] font-bold leading-none',
          'transition-opacity duration-150',
          bg, border, text,
          count === 0 && 'opacity-30',
        )}
        title={`${label}: ${count} card${count !== 1 ? 's' : ''} (${pct}%)`}
        aria-label={`${label}: ${count}`}
      >
        {symbol}
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground leading-none">
        {count}
      </span>
    </div>
  )
}

// ─── StatsBar ─────────────────────────────────────────────────────────────────

export function StatsBar({ cards, targetBracket, className }: StatsBarProps) {
  const cardCount = cards.length
  const avgCmc = computeAvgCmc(cards)
  const colorCounts = computeColorCounts(cards)
  const totalPrice = computeTotalPrice(cards)
  const totalColored = Object.values(colorCounts).reduce((a, b) => a + b, 0)
  const bracketLabel = BRACKET_LABELS[targetBracket] ?? BRACKET_LABELS[2]
  const bracketColor = BRACKET_BADGE_COLORS[targetBracket] ?? BRACKET_BADGE_COLORS[2]

  return (
    <div
      className={cn(
        'sticky top-0 z-20',
        'flex items-center justify-between gap-2 px-4 py-2',
        'bg-background/95 backdrop-blur-sm border-b',
        'overflow-x-auto',
        className,
      )}
    >
      {/* Left: core stats */}
      <div className="flex items-center divide-x divide-border shrink-0">
        <StatCell
          label="Cards"
          value={`${cardCount}/100`}
          className={cn(
            'pr-3 pl-0',
            cardCount === 100 && '[&_span:last-child]:text-emerald-600',
            cardCount > 100 && '[&_span:last-child]:text-red-500',
          )}
        />
        <StatCell label="Avg CMC" value={avgCmc} />
        <StatCell label="Value"   value={totalPrice} />
      </div>

      {/* Center: color pips */}
      <div className="flex items-center gap-2 px-3 shrink-0">
        {MTG_COLORS.map(({ symbol, label, bg, border, text }) => (
          <ColorPip
            key={symbol}
            symbol={symbol}
            label={label}
            bg={bg}
            border={border}
            text={text}
            count={colorCounts[symbol] ?? 0}
            total={totalColored}
          />
        ))}
      </div>

      {/* Right: bracket badge */}
      <div className="shrink-0">
        <span
          className={cn(
            'inline-flex items-center px-2.5 py-1 rounded-full',
            'text-[11px] font-semibold border',
            bracketColor,
          )}
        >
          Bracket {targetBracket} — {bracketLabel}
        </span>
      </div>
    </div>
  )
}
