'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { ChevronDown, ChevronUp, AlertTriangle, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import { removeCardFromDeck, updateCardQuantity } from '@/app/(dashboard)/decks/actions'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LegalityIssue {
  cardId: string
  cardName: string
  deckCardId: string
  type: 'color_identity' | 'banned' | 'not_legal' | 'over_limit'
  message: string
}

interface DeckLegalityBannerProps {
  deckId: string
  refreshKey?: number
}

// ─── Issue type labels ─────────────────────────────────────────────────────

const ISSUE_TYPE_LABELS: Record<LegalityIssue['type'], string> = {
  color_identity: 'Color Identity',
  banned:         'Banned',
  not_legal:      'Not Legal',
  over_limit:     'Over Limit',
}

// ─── DeckLegalityBanner ───────────────────────────────────────────────────────

export function DeckLegalityBanner({ deckId, refreshKey }: DeckLegalityBannerProps) {
  const [issues, setIssues] = useState<LegalityIssue[]>([])
  const [expanded, setExpanded] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [fixing, startFix] = useTransition()

  const fetchLegality = useCallback(async () => {
    try {
      const res = await fetch(`/api/decks/${deckId}/legality`)
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data.issues)) {
        setIssues(data.issues)
      }
    } catch {
      // Silently ignore — legality check is advisory
    } finally {
      setLoaded(true)
    }
  }, [deckId])

  useEffect(() => {
    void fetchLegality()
  }, [fetchLegality, refreshKey])

  // ── Fix helpers ──────────────────────────────────────────────────────────────

  function handleFixIssue(issue: LegalityIssue) {
    startFix(async () => {
      if (issue.type === 'over_limit') {
        await updateCardQuantity(issue.deckCardId, 1)
      } else {
        await removeCardFromDeck(deckId, issue.deckCardId)
      }
      await fetchLegality()
    })
  }

  function handleFixAll() {
    startFix(async () => {
      for (const issue of issues) {
        if (issue.type === 'over_limit') {
          await updateCardQuantity(issue.deckCardId, 1)
        } else {
          await removeCardFromDeck(deckId, issue.deckCardId)
        }
      }
      await fetchLegality()
    })
  }

  // Don't render until loaded, and skip if no issues
  if (!loaded || issues.length === 0) return null

  return (
    <div
      className={cn(
        'rounded-lg border px-4 py-3',
        'bg-warning-muted border-warning-border text-warning',
        fixing && 'opacity-70 pointer-events-none',
      )}
      role="alert"
      aria-label="Deck legality issues"
    >
      {/* Header row */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className={cn(
            'flex-1 flex items-center justify-between gap-2',
            'text-sm font-semibold text-left',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-warning rounded',
          )}
          aria-expanded={expanded}
        >
          <span className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            Deck has {issues.length} legality issue{issues.length !== 1 ? 's' : ''}
          </span>
          {expanded
            ? <ChevronUp className="size-4 shrink-0" aria-hidden />
            : <ChevronDown className="size-4 shrink-0" aria-hidden />
          }
        </button>

        <button
          type="button"
          onClick={handleFixAll}
          disabled={fixing}
          className={cn(
            'shrink-0 flex items-center gap-1',
            'rounded-md bg-warning text-warning-foreground',
            'hover:bg-warning/90 px-2.5 py-1 text-xs font-semibold',
            'transition-colors disabled:opacity-50',
          )}
        >
          <Wrench className="size-3" aria-hidden />
          Fix All
        </button>
      </div>

      {/* Expandable issue list */}
      {expanded && (
        <ul className="mt-3 space-y-1.5 border-t border-warning-border pt-3">
          {issues.map((issue) => (
            <li
              key={issue.deckCardId}
              className="flex items-center gap-2 text-xs"
            >
              <span
                className={cn(
                  'shrink-0 px-1.5 py-0.5 rounded-full',
                  'bg-warning text-warning-foreground font-semibold uppercase tracking-wide text-[9px]',
                )}
              >
                {ISSUE_TYPE_LABELS[issue.type]}
              </span>
              <span className="leading-snug flex-1 min-w-0">
                <span className="font-medium">{issue.cardName}</span>
                {' — '}
                {issue.message}
              </span>
              <button
                type="button"
                onClick={() => handleFixIssue(issue)}
                disabled={fixing}
                className={cn(
                  'rounded-md bg-warning text-warning-foreground',
                  'hover:bg-warning/90 px-2 py-1 text-2xs font-medium',
                  'transition-colors shrink-0 disabled:opacity-50',
                )}
              >
                Fix
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
