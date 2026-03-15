'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import {
  RecommendationCard,
  TIER_CONFIG,
  type Recommendation,
  type RecommendationTier,
} from '@/components/ai/recommendation-card'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RecommendationsResult {
  recommendations: Recommendation[]
  summary: string
  estimated_bracket_after: number
  estimated_price_delta_cents: number
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TIER_ORDER: RecommendationTier[] = ['must_cut', 'must_add', 'consider_cutting', 'consider_adding']

export default function RecommendationsPage() {
  const params = useParams<{ id: string }>()
  const deckId = params.id

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RecommendationsResult | null>(null)
  const analysisId = ''
  const [acceptedCount, setAcceptedCount] = useState(0)

  async function fetchRecommendations() {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/ai/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deckId }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Request failed: ${res.status}`)
      }

      // Stream the response
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          accumulated += decoder.decode(value, { stream: true })

          // Try to parse partial JSON as it streams
          try {
            const parsed = JSON.parse(accumulated)
            if (parsed.recommendations) {
              setResult(parsed as RecommendationsResult)
            }
          } catch {
            // Not yet valid JSON — keep accumulating
          }
        }

        // Final parse
        try {
          const parsed = JSON.parse(accumulated)
          setResult(parsed as RecommendationsResult)
        } catch {
          // Stream may use line-delimited format — take last valid object
          const lines = accumulated.split('\n').filter(Boolean)
          for (let i = lines.length - 1; i >= 0; i--) {
            try {
              const parsed = JSON.parse(lines[i])
              if (parsed.recommendations) {
                setResult(parsed as RecommendationsResult)
                break
              }
            } catch {
              // keep going
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const recsByTier = TIER_ORDER.reduce<Record<RecommendationTier, Recommendation[]>>(
    (acc, tier) => {
      acc[tier] = result?.recommendations.filter((r) => r.tier === tier) ?? []
      return acc
    },
    { must_cut: [], must_add: [], consider_cutting: [], consider_adding: [] }
  )

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Swap Recommendations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            AI-powered suggestions to improve your deck
          </p>
        </div>

        <button
          onClick={fetchRecommendations}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors disabled:opacity-60"
        >
          {loading ? (
            <>
              <svg className="animate-spin size-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Analyzing…
            </>
          ) : (
            <>
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347a3.5 3.5 0 01-4.95 0l-.347-.347z" />
              </svg>
              {result ? 'Regenerate' : 'Get Recommendations'}
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !result && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border bg-muted/30 p-4 h-28 animate-pulse" />
          ))}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Summary banner */}
          <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
            <p className="text-sm text-foreground leading-relaxed">{result.summary}</p>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>
                Bracket after:{' '}
                <strong className="text-foreground">{result.estimated_bracket_after}</strong>
              </span>
              <span>
                Price delta:{' '}
                <strong className={result.estimated_price_delta_cents >= 0 ? 'text-red-600' : 'text-green-600'}>
                  {result.estimated_price_delta_cents >= 0 ? '+' : ''}
                  ${(result.estimated_price_delta_cents / 100).toFixed(2)}
                </strong>
              </span>
              {acceptedCount > 0 && (
                <span>
                  Accepted: <strong className="text-green-700">{acceptedCount}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Tiered sections */}
          {TIER_ORDER.map((tier) => {
            const recs = recsByTier[tier]
            if (recs.length === 0) return null
            const cfg = TIER_CONFIG[tier]
            return (
              <section key={tier} className="space-y-3">
                <h2 className={`text-sm font-semibold uppercase tracking-wider ${cfg.color}`}>
                  {cfg.label} ({recs.length})
                </h2>
                {recs.map((rec, i) => (
                  <RecommendationCard
                    key={`${tier}-${i}`}
                    rec={rec}
                    deckId={deckId}
                    analysisId={analysisId}
                    onAccepted={() => setAcceptedCount((c) => c + 1)}
                  />
                ))}
              </section>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && !result && !error && (
        <div className="rounded-xl border bg-muted/20 p-12 text-center space-y-3">
          <div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto">
            <svg className="size-6 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">
            Click &ldquo;Get Recommendations&rdquo; to generate AI-powered swap suggestions for your deck.
          </p>
        </div>
      )}
    </div>
  )
}
