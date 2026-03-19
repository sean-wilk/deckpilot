'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

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
}

// ─── Issue type labels ─────────────────────────────────────────────────────

const ISSUE_TYPE_LABELS: Record<LegalityIssue['type'], string> = {
  color_identity: 'Color Identity',
  banned:         'Banned',
  not_legal:      'Not Legal',
  over_limit:     'Over Limit',
}

// ─── DeckLegalityBanner ───────────────────────────────────────────────────────

export function DeckLegalityBanner({ deckId }: DeckLegalityBannerProps) {
  const [issues, setIssues] = useState<LegalityIssue[]>([])
  const [expanded, setExpanded] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function fetchLegality() {
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
    }
    void fetchLegality()
  }, [deckId])

  // Don't render until loaded, and skip if no issues
  if (!loaded || issues.length === 0) return null

  return (
    <div
      className={cn(
        'rounded-lg border px-4 py-3',
        'bg-warning-muted border-warning-border text-warning',
      )}
      role="alert"
      aria-label="Deck legality issues"
    >
      {/* Header row */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className={cn(
          'w-full flex items-center justify-between gap-2',
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

      {/* Expandable issue list */}
      {expanded && (
        <ul className="mt-3 space-y-1.5 border-t border-warning-border pt-3">
          {issues.map((issue) => (
            <li
              key={issue.deckCardId}
              className="flex items-start gap-2 text-xs"
            >
              <span
                className={cn(
                  'shrink-0 mt-0.5 px-1.5 py-0.5 rounded-full',
                  'bg-warning text-warning-foreground font-semibold uppercase tracking-wide text-[9px]',
                )}
              >
                {ISSUE_TYPE_LABELS[issue.type]}
              </span>
              <span className="leading-snug">
                <span className="font-medium">{issue.cardName}</span>
                {' — '}
                {issue.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
