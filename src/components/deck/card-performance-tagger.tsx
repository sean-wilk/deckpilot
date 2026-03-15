'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { tagCardPerformance } from '@/app/(dashboard)/decks/[id]/matches/actions'

// ─── Types ────────────────────────────────────────────────────────────────────

type Performance = 'mvp' | 'underperformer' | null

interface CardPerformance {
  cardId: string
  performance: Performance
}

export interface CardPerformanceTaggerProps {
  matchId: string
  cards: { id: string; name: string }[]
  onComplete?: () => void
}

// ─── Card row ─────────────────────────────────────────────────────────────────

interface CardRowProps {
  card: { id: string; name: string }
  performance: Performance
  onSelect: (cardId: string, performance: Performance) => void
}

function CardRow({ card, performance, onSelect }: CardRowProps) {
  function toggle(value: 'mvp' | 'underperformer') {
    onSelect(card.id, performance === value ? null : value)
  }

  return (
    <div className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
      <span className="flex-1 text-sm truncate">{card.name}</span>

      <div className="flex items-center gap-1.5">
        {/* MVP button */}
        <button
          type="button"
          onClick={() => toggle('mvp')}
          aria-label={`Mark ${card.name} as MVP`}
          aria-pressed={performance === 'mvp'}
          className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors',
            performance === 'mvp'
              ? 'bg-green-600 text-white'
              : 'bg-muted text-muted-foreground hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/30 dark:hover:text-green-400',
          )}
        >
          <span aria-hidden>★</span>
          <span>MVP</span>
        </button>

        {/* Underperformer button */}
        <button
          type="button"
          onClick={() => toggle('underperformer')}
          aria-label={`Mark ${card.name} as Underperformer`}
          aria-pressed={performance === 'underperformer'}
          className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors',
            performance === 'underperformer'
              ? 'bg-red-600 text-white'
              : 'bg-muted text-muted-foreground hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900/30 dark:hover:text-red-400',
          )}
        >
          <span aria-hidden>👎</span>
          <span>Underperformer</span>
        </button>
      </div>
    </div>
  )
}

// ─── CardPerformanceTagger ────────────────────────────────────────────────────

export function CardPerformanceTagger({ matchId, cards, onComplete }: CardPerformanceTaggerProps) {
  const [performances, setPerformances] = useState<Map<string, Performance>>(new Map())
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSelect(cardId: string, performance: Performance) {
    setPerformances((prev) => {
      const next = new Map(prev)
      if (performance === null) {
        next.delete(cardId)
      } else {
        next.set(cardId, performance)
      }
      return next
    })
  }

  function handleSubmit() {
    const tagged: CardPerformance[] = []
    for (const [cardId, performance] of performances.entries()) {
      if (performance !== null) {
        tagged.push({ cardId, performance })
      }
    }

    setError(null)
    startTransition(async () => {
      try {
        await tagCardPerformance(matchId, tagged as { cardId: string; performance: 'mvp' | 'underperformer'; note?: string }[])
        onComplete?.()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save card performance')
      }
    })
  }

  const taggedCount = performances.size
  const mvpCount = [...performances.values()].filter((p) => p === 'mvp').length
  const underperformerCount = [...performances.values()].filter((p) => p === 'underperformer').length

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold">Tag Card Performance</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Mark standout cards from this match. Untagged cards are skipped.
        </p>
      </div>

      {/* Summary badges */}
      {taggedCount > 0 && (
        <div className="flex gap-2 text-xs">
          {mvpCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">
              {mvpCount} MVP{mvpCount !== 1 ? 's' : ''}
            </span>
          )}
          {underperformerCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium">
              {underperformerCount} underperformer{underperformerCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Card list */}
      <div className="flex flex-col divide-y divide-border/50 border border-border rounded-md overflow-hidden max-h-96 overflow-y-auto">
        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4 text-center">No cards in deck.</p>
        ) : (
          cards.map((card) => (
            <CardRow
              key={card.id}
              card={card}
              performance={performances.get(card.id) ?? null}
              onSelect={handleSelect}
            />
          ))
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 justify-end">
        <button
          type="button"
          onClick={onComplete}
          disabled={isPending}
          className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-50"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || taggedCount === 0}
          className={cn(
            'px-3 py-1.5 text-sm rounded-md font-medium transition-colors',
            'bg-primary text-primary-foreground hover:bg-primary/90',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          {isPending ? 'Saving…' : `Save ${taggedCount > 0 ? taggedCount : ''} tag${taggedCount !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}
