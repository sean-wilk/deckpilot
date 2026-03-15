'use client'

import Link from 'next/link'
import { Upload, Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button-variants'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DeckPageHeaderProps {
  deck: {
    id: string
    name: string
    description: string | null
    targetBracket: number
    format: string
    isPublic: boolean
    budgetLimitCents: number | null
  }
  isOwner: boolean
  cardCount: number
  children?: React.ReactNode // Slot for DeckSettingsDialog + ExportDropdown
}

// ─── Bracket config ───────────────────────────────────────────────────────────

const BRACKET_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Precon',    color: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' },
  2: { label: 'Focused',   color: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800'                  },
  3: { label: 'Optimized', color: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800'       },
  4: { label: 'cEDH',      color: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800'                         },
}

// ─── DeckPageHeader ───────────────────────────────────────────────────────────

export function DeckPageHeader({
  deck,
  isOwner,
  cardCount,
  children,
}: DeckPageHeaderProps) {
  const bracket = BRACKET_LABELS[deck.targetBracket] ?? BRACKET_LABELS[2]

  return (
    <div className="flex flex-col gap-2 pb-4 border-b">
      {/* Top row: name + actions */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        {/* Left: title + meta */}
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-foreground truncate">
              {deck.name}
            </h1>
            {/* Bracket badge */}
            <span
              className={cn(
                'inline-flex items-center px-2.5 py-0.5 rounded-full',
                'text-[11px] font-semibold border shrink-0',
                bracket.color,
              )}
            >
              Bracket {deck.targetBracket} — {bracket.label}
            </span>
            {/* Card count */}
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full shrink-0',
                'text-[11px] font-medium border',
                'bg-muted text-muted-foreground border-border',
                cardCount === 100 && 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
                cardCount > 100  && 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
              )}
            >
              {cardCount} / 100 cards
            </span>
          </div>

          {/* Description */}
          {deck.description && (
            <p className="text-sm text-muted-foreground leading-snug max-w-prose">
              {deck.description}
            </p>
          )}
        </div>

        {/* Right: owner actions */}
        {isOwner && (
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Import Cards */}
            <Link
              href={`/decks/${deck.id}/import`}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
              )}
            >
              <Upload className="size-3.5" />
              Import Cards
            </Link>

            {/* Get Recommendations */}
            <Link
              href={`/decks/${deck.id}/recommendations`}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
              )}
            >
              <Sparkles className="size-3.5" />
              Get Recommendations
            </Link>

            {/* Settings gear — slot from children */}
            {children}
          </div>
        )}
      </div>
    </div>
  )
}
