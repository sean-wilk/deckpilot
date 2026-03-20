'use client'

import Link from 'next/link'
import { Upload, Trophy } from 'lucide-react'

import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button-variants'
import { BRACKET_LABELS, BRACKET_BADGE_COLORS } from '@/lib/constants/brackets'

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

// ─── DeckPageHeader ───────────────────────────────────────────────────────────

export function DeckPageHeader({
  deck,
  isOwner,
  cardCount,
  children,
}: DeckPageHeaderProps) {
  const bracketLabel = BRACKET_LABELS[deck.targetBracket] ?? BRACKET_LABELS[2]
  const bracketColor = BRACKET_BADGE_COLORS[deck.targetBracket] ?? BRACKET_BADGE_COLORS[2]

  return (
    <div className="flex flex-col gap-2 pb-4 border-b">
      {/* Top row: name + actions */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
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
                'text-xs-plus font-semibold border shrink-0',
                bracketColor,
              )}
            >
              Bracket {deck.targetBracket} — {bracketLabel}
            </span>
            {/* Card count */}
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full shrink-0',
                'text-xs-plus font-medium border',
                'bg-muted text-muted-foreground border-border',
                cardCount === 100 && 'bg-success-muted text-success border-success-border',
                cardCount > 100  && 'bg-error-muted text-error border-error-border',
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
            {/* Match History */}
            <Link
              href={`/decks/${deck.id}/matches`}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
              )}
            >
              <Trophy className="size-3.5" />
              <span className="hidden lg:inline">Match History</span>
            </Link>

            {/* Import Cards */}
            <Link
              href={`/decks/${deck.id}/import`}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
              )}
            >
              <Upload className="size-3.5" />
              <span className="hidden lg:inline">Import Cards</span>
            </Link>

            {/* Settings gear — slot from children */}
            {children}
          </div>
        )}
      </div>
    </div>
  )
}
