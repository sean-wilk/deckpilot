'use client'

import { useState, useCallback, useRef, useTransition } from 'react'
import Link from 'next/link'
import { SwapRecommendationSchema } from '@/lib/ai/schemas'
import type { z } from 'zod'

// ─── useObject ────────────────────────────────────────────────────────────────
// Compatible implementation of the ai/react `useObject` hook API.
// Streams structured JSON from the API and progressively hydrates the object.

type UseObjectOptions<T extends z.ZodTypeAny> = {
  api: string
  schema: T
  onError?: (err: Error) => void
}

type UseObjectResult<T> = {
  object: Partial<T> | undefined
  isLoading: boolean
  error: Error | null
  submit: (body: Record<string, unknown>) => void
  stop: () => void
}

function useObject<T extends z.ZodTypeAny>(
  options: UseObjectOptions<T>
): UseObjectResult<z.infer<T>> {
  const { api, onError } = options
  const [object, setObject] = useState<Partial<z.infer<T>> | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const stop = useCallback(() => {
    abortRef.current?.abort()
    setIsLoading(false)
  }, [])

  const submit = useCallback(
    async (body: Record<string, unknown>) => {
      setIsLoading(true)
      setError(null)
      setObject(undefined)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch(api, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        })

        if (!res.ok) {
          const fetchErr = new Error(`HTTP ${res.status}`)
          ;(fetchErr as Error & { status: number }).status = res.status as number
          throw fetchErr
        }

        const reader = res.body?.getReader()
        if (!reader) throw new Error('No response body')

        const decoder = new TextDecoder()
        let accumulated = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          accumulated += decoder.decode(value, { stream: true })

          const lines = accumulated.split('\n')
          let lastValidObject: Partial<z.infer<T>> | undefined

          for (const line of lines) {
            const trimmed = line.trim()
            if (trimmed.startsWith('0:') || trimmed.startsWith('2:')) {
              try {
                const jsonStr = trimmed.slice(2)
                const parsed = JSON.parse(jsonStr) as z.infer<T>
                if (parsed && typeof parsed === 'object') {
                  lastValidObject = parsed as Partial<z.infer<T>>
                }
              } catch {
                // partial chunk — keep accumulating
              }
            }
          }

          if (!lastValidObject) {
            try {
              const parsed = JSON.parse(accumulated) as z.infer<T>
              if (parsed && typeof parsed === 'object') {
                lastValidObject = parsed as Partial<z.infer<T>>
              }
            } catch {
              // still accumulating
            }
          }

          if (lastValidObject) {
            setObject(lastValidObject)
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        const normalized = err instanceof Error ? err : new Error(String(err))
        setError(normalized)
        onError?.(normalized)
      } finally {
        setIsLoading(false)
      }
    },
    [api, onError]
  )

  return { object, isLoading, error, submit, stop }
}


import { RecommendationCard, type Recommendation, type RecommendationTier, TIER_CONFIG } from '@/components/ai/recommendation-card'
import { createDeckSnapshot } from '@/app/(dashboard)/decks/actions'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface RecommendationsPanelProps {
  deckId: string
  cardCount: number
}

// ─── Tier group ────────────────────────────────────────────────────────────────

const TIER_ORDER: RecommendationTier[] = ['must_cut', 'consider_cutting', 'must_add', 'consider_adding']

function TierGroup({
  tier,
  recs,
  deckId,
  analysisId,
  onAccepted,
}: {
  tier: RecommendationTier
  recs: Recommendation[]
  deckId: string
  analysisId: string
  onAccepted: () => void
}) {
  if (recs.length === 0) return null
  const cfg = TIER_CONFIG[tier]
  return (
    <div className="space-y-2">
      <h4 className={`text-xs font-semibold uppercase tracking-wide ${cfg.color}`}>
        {cfg.label} ({recs.length})
      </h4>
      <div className="space-y-2">
        {recs.map((rec, i) => (
          <RecommendationCard
            key={`${tier}-${i}`}
            rec={rec}
            deckId={deckId}
            analysisId={analysisId}
            onAccepted={onAccepted}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Summary banner ────────────────────────────────────────────────────────────

function SummaryBanner({
  summary,
  estimatedBracket,
  priceDeltaCents,
}: {
  summary: string
  estimatedBracket: number | null | undefined
  priceDeltaCents: number | null | undefined
}) {
  const priceDelta = priceDeltaCents != null ? priceDeltaCents / 100 : null

  return (
    <div className="rounded-lg border bg-muted/50 p-3 space-y-1.5">
      {summary && <p className="text-sm text-foreground leading-relaxed">{summary}</p>}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {estimatedBracket != null && (
          <span>
            Estimated bracket after:{' '}
            <span className="font-semibold text-foreground">B{estimatedBracket}</span>
          </span>
        )}
        {priceDelta != null && (
          <span>
            Price delta:{' '}
            <span className={`font-semibold ${priceDelta >= 0 ? 'text-red-600' : 'text-green-600'}`}>
              {priceDelta >= 0 ? '+' : ''}${priceDelta.toFixed(2)}
            </span>
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function RecommendationsPanel({ deckId, cardCount }: RecommendationsPanelProps) {
  const [error, setError] = useState<string | null>(null)
  const [snapshotTaken, setSnapshotTaken] = useState(false)
  const [, startSnapshotTransition] = useTransition()

  // Stable pseudo-analysisId for this session (just used as a key for the action)
  const [analysisId] = useState('panel-session')

  const { object, submit, isLoading, stop } = useObject({
    api: '/api/ai/recommendations',
    schema: SwapRecommendationSchema,
    onError: (err: Error) => {
      setError(err.message ?? 'Failed to get recommendations')
    },
  })

  function handleGetRecommendations() {
    setError(null)
    submit({ deckId })
  }

  function handleAccepted() {
    if (!snapshotTaken) {
      startSnapshotTransition(async () => {
        try {
          await createDeckSnapshot(deckId, 'AI recommendation applied')
          setSnapshotTaken(true)
        } catch {
          // Non-fatal — snapshot failure shouldn't block acceptance
        }
      })
    }
  }

  const recommendations = object?.recommendations ?? []

  // Group by tier
  const byTier = TIER_ORDER.reduce<Record<RecommendationTier, Recommendation[]>>(
    (acc, tier) => {
      acc[tier] = recommendations.filter(
        (r): r is Recommendation =>
          r != null &&
          r.tier === tier &&
          typeof r.reasoning === 'string' &&
          typeof r.impact_summary === 'string' &&
          Array.isArray(r.tags)
      )
      return acc
    },
    { must_cut: [], consider_cutting: [], must_add: [], consider_adding: [] }
  )

  const hasRecommendations = recommendations.length > 0
  const hasSummary = !!object?.summary || object?.estimated_bracket_after != null || object?.estimated_price_delta_cents != null

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">AI Recommendations</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {cardCount} card{cardCount !== 1 ? 's' : ''} · Swap suggestions powered by AI
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isLoading && (
            <button
              onClick={stop}
              className="text-xs px-2.5 py-1.5 rounded-lg border bg-background hover:bg-muted transition-colors"
            >
              Stop
            </button>
          )}
          <button
            onClick={handleGetRecommendations}
            disabled={isLoading}
            className="text-xs px-3 py-1.5 rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50 font-medium"
          >
            {isLoading ? 'Thinking…' : hasRecommendations ? 'Refresh' : 'Get Recommendations'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Loading skeleton / streaming indicator */}
      {isLoading && !hasRecommendations && (
        <div className="rounded-lg border bg-muted/50 p-4 text-xs text-muted-foreground text-center animate-pulse">
          Generating recommendations…
        </div>
      )}

      {/* Summary banner */}
      {hasSummary && (
        <SummaryBanner
          summary={object?.summary ?? ''}
          estimatedBracket={object?.estimated_bracket_after}
          priceDeltaCents={object?.estimated_price_delta_cents}
        />
      )}

      {/* Tier groups */}
      {hasRecommendations && (
        <div className="space-y-4">
          {TIER_ORDER.map((tier) => (
            <TierGroup
              key={tier}
              tier={tier}
              recs={byTier[tier]}
              deckId={deckId}
              analysisId={analysisId}
              onAccepted={handleAccepted}
            />
          ))}
        </div>
      )}

      {/* View full page link */}
      {hasRecommendations && (
        <div className="pt-1">
          <Link
            href={`/decks/${deckId}/recommendations`}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            View full recommendations page →
          </Link>
        </div>
      )}
    </div>
  )
}
