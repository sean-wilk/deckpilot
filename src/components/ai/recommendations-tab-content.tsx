'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { TIER_CONFIG, TAG_LABELS } from '@/components/ai/recommendation-card'
import type { RecommendationTier, RecommendationTag } from '@/components/ai/recommendation-card'

// ─── Types ─────────────────────────────────────────────────────────────────────

type RecStatus = 'accepted' | 'skipped' | 'dismissed' | null

interface PersistedRecommendation {
  id: string
  tier: RecommendationTier
  cardOutName: string | null
  cardOutImageUri: Record<string, string> | null
  cardInName: string | null
  cardInImageUri: Record<string, string> | null
  reasoning: string
  impactSummary: string
  tags: RecommendationTag[]
  /** DB stored: true = accepted, false = skipped, null = pending */
  accepted: boolean | null
  sortOrder: number
}

interface PersistedResponse {
  analysisId: string
  recommendations: PersistedRecommendation[]
  summary: string | null
  estimatedBracketAfter: number | null
  createdAt: string
}

// Local status overlay (from this session's PATCH calls, not yet refetched)
type LocalStatusMap = Record<string, RecStatus>

// ─── Helpers ───────────────────────────────────────────────────────────────────

function dbAcceptedToStatus(accepted: boolean | null): RecStatus {
  if (accepted === true) return 'accepted'
  if (accepted === false) return 'skipped'
  return null
}

function getCardImageUrl(imageUri: Record<string, string> | null): string | null {
  if (!imageUri) return null
  // Prefer small art crop, then normal, then any key
  return imageUri['small'] ?? imageUri['art_crop'] ?? imageUri['normal'] ?? Object.values(imageUri)[0] ?? null
}

// ─── Streaming (POST /api/ai/recommendations) ──────────────────────────────────

type StreamedRec = {
  tier?: RecommendationTier
  card_out?: string | null
  card_in?: string | null
  reasoning?: string
  impact_summary?: string
  tags?: RecommendationTag[]
}

type StreamedResult = {
  recommendations?: StreamedRec[]
  summary?: string
  estimated_bracket_after?: number
  estimated_price_delta_cents?: number
}

// ─── Card image component ──────────────────────────────────────────────────────

function CardImage({
  imageUri,
  cardName,
  variant,
}: {
  imageUri: Record<string, string> | null
  cardName: string | null
  variant: 'cut' | 'add'
}) {
  const url = getCardImageUrl(imageUri)
  const borderClass = variant === 'cut' ? 'border-red-400/60' : 'border-green-400/60'
  const ringClass = variant === 'cut' ? 'ring-red-300/30' : 'ring-green-300/30'

  if (!url || !cardName) return null

  return (
    <div className={`relative shrink-0 rounded-lg overflow-hidden border-2 ${borderClass} ring-2 ${ringClass} shadow-md`}
      style={{ width: 73, height: 102 }}>
      <Image
        src={url}
        alt={cardName}
        fill
        className="object-cover"
        sizes="73px"
        unoptimized
      />
    </div>
  )
}

// ─── Summary banner ────────────────────────────────────────────────────────────

function SummaryBanner({
  summary,
  estimatedBracketAfter,
  priceDeltaCents,
}: {
  summary: string | null
  estimatedBracketAfter: number | null | undefined
  priceDeltaCents?: number | null
}) {
  const priceDelta = priceDeltaCents != null ? priceDeltaCents / 100 : null

  return (
    <div className="rounded-lg border bg-muted/50 p-3 space-y-1.5">
      {summary && <p className="text-sm text-foreground leading-relaxed">{summary}</p>}
      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        {estimatedBracketAfter != null && (
          <span>
            Estimated bracket after:{' '}
            <span className="font-semibold text-foreground">B{estimatedBracketAfter}</span>
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

// ─── Persisted recommendation card ────────────────────────────────────────────

function PersistedRecCard({
  rec,
  deckId,
  localStatus,
  onStatusChange,
}: {
  rec: PersistedRecommendation
  deckId: string
  localStatus: RecStatus
  onStatusChange: (id: string, status: RecStatus) => void
}) {
  const [isPending, setIsPending] = useState(false)
  const tierCfg = TIER_CONFIG[rec.tier]

  // Effective status: local override takes precedence, else from DB
  const effectiveStatus = localStatus !== undefined ? localStatus : dbAcceptedToStatus(rec.accepted)

  // Dismissed cards are hidden at parent level
  if (effectiveStatus === 'dismissed') return null

  async function handleStatus(status: 'accepted' | 'skipped' | 'dismissed') {
    setIsPending(true)
    try {
      const res = await fetch(`/api/ai/recommendations/${deckId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendationId: rec.id, status }),
      })
      if (res.ok) {
        onStatusChange(rec.id, status)
      }
    } catch {
      // Non-fatal — leave status unchanged
    } finally {
      setIsPending(false)
    }
  }

  const isCut = rec.tier === 'must_cut' || rec.tier === 'consider_cutting'

  return (
    <div
      className={`rounded-xl border p-4 space-y-3 transition-opacity ${tierCfg.bg} ${tierCfg.border} ${
        effectiveStatus === 'skipped' ? 'opacity-50' : ''
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${tierCfg.color} ${tierCfg.bg} ${tierCfg.border}`}>
            {tierCfg.label}
          </span>
          {effectiveStatus === 'accepted' && (
            <span className="text-xs font-medium text-green-700 bg-green-100 border border-green-200 px-2 py-0.5 rounded-full">
              Accepted
            </span>
          )}
          {effectiveStatus === 'skipped' && (
            <span className="text-xs font-medium text-muted-foreground bg-muted border px-2 py-0.5 rounded-full">
              Skipped
            </span>
          )}
        </div>

        {/* Action buttons */}
        {effectiveStatus === null && (
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={() => handleStatus('dismissed')}
              disabled={isPending}
              className="text-xs px-2 py-1 rounded-lg border bg-background hover:bg-muted transition-colors disabled:opacity-50 text-muted-foreground"
              title="Dismiss"
            >
              ✕
            </button>
            <button
              onClick={() => handleStatus('skipped')}
              disabled={isPending}
              className="text-xs px-2.5 py-1 rounded-lg border bg-background hover:bg-muted transition-colors disabled:opacity-50"
            >
              Skip
            </button>
            <button
              onClick={() => handleStatus('accepted')}
              disabled={isPending}
              className="text-xs px-2.5 py-1 rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50 font-medium"
            >
              {isPending ? 'Applying…' : 'Accept'}
            </button>
          </div>
        )}
      </div>

      {/* Card images + swap arrow */}
      <div className="flex items-center gap-3">
        {isCut ? (
          <>
            {rec.cardOutName && (
              <CardImage imageUri={rec.cardOutImageUri} cardName={rec.cardOutName} variant="cut" />
            )}
            {rec.cardOutName && rec.cardInName && (
              <span className="text-muted-foreground text-sm font-light">→</span>
            )}
            {rec.cardInName && (
              <CardImage imageUri={rec.cardInImageUri} cardName={rec.cardInName} variant="add" />
            )}
          </>
        ) : (
          <>
            {rec.cardInName && (
              <CardImage imageUri={rec.cardInImageUri} cardName={rec.cardInName} variant="add" />
            )}
            {rec.cardOutName && rec.cardInName && (
              <span className="text-muted-foreground text-sm font-light">→</span>
            )}
            {rec.cardOutName && (
              <CardImage imageUri={rec.cardOutImageUri} cardName={rec.cardOutName} variant="cut" />
            )}
          </>
        )}

        {/* Names beside images */}
        <div className="flex-1 min-w-0 space-y-1">
          {rec.cardOutName && (
            <p className="text-xs">
              <span className="font-medium text-red-800 bg-red-100 border border-red-200 px-1.5 py-0.5 rounded">
                {rec.cardOutName}
              </span>
            </p>
          )}
          {rec.cardInName && (
            <p className="text-xs">
              <span className="font-medium text-green-800 bg-green-100 border border-green-200 px-1.5 py-0.5 rounded">
                {rec.cardInName}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Impact summary */}
      <p className="text-xs font-medium text-foreground">{rec.impactSummary}</p>

      {/* Reasoning */}
      <p className="text-xs text-muted-foreground leading-relaxed">{rec.reasoning}</p>

      {/* Tags */}
      {Array.isArray(rec.tags) && rec.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {rec.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border"
            >
              {TAG_LABELS[tag] ?? tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Streamed recommendation card (from live generation) ──────────────────────

function StreamedRecCard({ rec }: { rec: StreamedRec }) {
  if (!rec.tier) return null
  const tierCfg = TIER_CONFIG[rec.tier]
  const isCut = rec.tier === 'must_cut' || rec.tier === 'consider_cutting'

  return (
    <div className={`rounded-xl border p-4 space-y-3 animate-pulse-subtle ${tierCfg.bg} ${tierCfg.border}`}>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${tierCfg.color} ${tierCfg.bg} ${tierCfg.border}`}>
          {tierCfg.label}
        </span>
        <span className="text-xs text-muted-foreground italic">streaming…</span>
      </div>

      {(rec.card_out || rec.card_in) && (
        <div className="flex items-center gap-2 text-sm flex-wrap">
          {isCut ? (
            <>
              {rec.card_out && (
                <span className="font-medium text-red-800 bg-red-100 border border-red-200 px-2 py-0.5 rounded">
                  {rec.card_out}
                </span>
              )}
              {rec.card_out && rec.card_in && <span className="text-muted-foreground">→</span>}
              {rec.card_in && (
                <span className="font-medium text-green-800 bg-green-100 border border-green-200 px-2 py-0.5 rounded">
                  {rec.card_in}
                </span>
              )}
            </>
          ) : (
            <>
              {rec.card_in && (
                <span className="font-medium text-green-800 bg-green-100 border border-green-200 px-2 py-0.5 rounded">
                  {rec.card_in}
                </span>
              )}
            </>
          )}
        </div>
      )}

      {rec.impact_summary && (
        <p className="text-xs font-medium text-foreground">{rec.impact_summary}</p>
      )}
      {rec.reasoning && (
        <p className="text-xs text-muted-foreground leading-relaxed">{rec.reasoning}</p>
      )}
      {Array.isArray(rec.tags) && rec.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {rec.tags.map((tag) => (
            <span key={tag} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border">
              {TAG_LABELS[tag] ?? tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

interface RecommendationsTabContentProps {
  deckId: string
  cardCount: number
  focus?: string
  wildcardMode?: boolean
}

type ActiveTab = 'cuts' | 'adds'

export function RecommendationsTabContent({
  deckId,
  cardCount,
  focus,
  wildcardMode: initialWildcardMode = false,
}: RecommendationsTabContentProps) {
  const [persisted, setPersisted] = useState<PersistedResponse | null>(null)
  const [loadingPersisted, setLoadingPersisted] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Streaming state
  const [streamedResult, setStreamedResult] = useState<StreamedResult | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamError, setStreamError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Local status overrides (from PATCH calls this session)
  const [localStatuses, setLocalStatuses] = useState<LocalStatusMap>({})

  // Wildcard / discovery mode
  const [wildcardMode, setWildcardMode] = useState(initialWildcardMode)

  // Sub-tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('cuts')

  // ── Load persisted recommendations on mount ──────────────────────────────────

  useEffect(() => {
    let cancelled = false

    async function loadPersisted() {
      setLoadingPersisted(true)
      setFetchError(null)
      try {
        const res = await fetch(`/api/ai/recommendations/${deckId}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json() as PersistedResponse | null
        if (!cancelled) setPersisted(data)
      } catch (err) {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : 'Failed to load recommendations')
        }
      } finally {
        if (!cancelled) setLoadingPersisted(false)
      }
    }

    void loadPersisted()
    return () => { cancelled = true }
  }, [deckId])

  // ── Status change handler ────────────────────────────────────────────────────

  const handleStatusChange = useCallback((id: string, status: RecStatus) => {
    setLocalStatuses((prev) => ({ ...prev, [id]: status }))
  }, [])

  // ── Stream new recommendations ───────────────────────────────────────────────

  async function handleGenerate() {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsStreaming(true)
    setStreamError(null)
    setStreamedResult(null)

    try {
      const body: Record<string, unknown> = { deckId, wildcardMode }
      if (focus) body.focus = focus

      const res = await fetch('/api/ai/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })

        const lines = accumulated.split('\n')
        let lastValid: StreamedResult | undefined

        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed.startsWith('0:') || trimmed.startsWith('2:')) {
            try {
              const parsed = JSON.parse(trimmed.slice(2)) as StreamedResult
              if (parsed && typeof parsed === 'object') lastValid = parsed
            } catch { /* partial */ }
          }
        }

        if (!lastValid) {
          try {
            const parsed = JSON.parse(accumulated) as StreamedResult
            if (parsed && typeof parsed === 'object') lastValid = parsed
          } catch { /* accumulating */ }
        }

        if (lastValid) setStreamedResult(lastValid)
      }

      // After streaming completes, reload persisted to get DB-saved records with IDs
      const reloadRes = await fetch(`/api/ai/recommendations/${deckId}`)
      if (reloadRes.ok) {
        const fresh = await reloadRes.json() as PersistedResponse | null
        setPersisted(fresh)
        setStreamedResult(null)
        setLocalStatuses({})
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setStreamError(err instanceof Error ? err.message : 'Failed to get recommendations')
    } finally {
      setIsStreaming(false)
    }
  }

  function handleStop() {
    abortRef.current?.abort()
    setIsStreaming(false)
  }

  // ── Derive display data ──────────────────────────────────────────────────────

  // While streaming, show streamed recs; after completion show persisted
  const showStreaming = isStreaming && !!streamedResult?.recommendations?.length
  const showPersisted = !isStreaming && !!persisted?.recommendations?.length

  const cuts = (persisted?.recommendations ?? []).filter(
    (r) => r.tier === 'must_cut' || r.tier === 'consider_cutting'
  )
  const adds = (persisted?.recommendations ?? []).filter(
    (r) => r.tier === 'must_add' || r.tier === 'consider_adding'
  )

  const streamedCuts = (streamedResult?.recommendations ?? []).filter(
    (r) => r.tier === 'must_cut' || r.tier === 'consider_cutting'
  )
  const streamedAdds = (streamedResult?.recommendations ?? []).filter(
    (r) => r.tier === 'must_add' || r.tier === 'consider_adding'
  )

  // Filter dismissed
  const visibleCuts = cuts.filter((r) => {
    const status = localStatuses[r.id] !== undefined ? localStatuses[r.id] : dbAcceptedToStatus(r.accepted)
    return status !== 'dismissed'
  })
  const visibleAdds = adds.filter((r) => {
    const status = localStatuses[r.id] !== undefined ? localStatuses[r.id] : dbAcceptedToStatus(r.accepted)
    return status !== 'dismissed'
  })

  const hasContent = showPersisted || showStreaming
  const hasRecs = persisted?.recommendations?.length ?? 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">AI Recommendations</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {cardCount} card{cardCount !== 1 ? 's' : ''}
            {focus ? ` · Focus: ${focus}` : ''}
            {' · '}Swap suggestions powered by AI
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Mode badge + toggle */}
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
            wildcardMode
              ? 'bg-purple-100 text-purple-700 border-purple-200'
              : 'bg-blue-100 text-blue-700 border-blue-200'
          }`}>
            Mode: {wildcardMode ? 'Discovery' : 'Optimized'}
          </span>
          <button
            onClick={() => setWildcardMode((prev) => !prev)}
            disabled={isStreaming}
            className="text-[10px] px-2 py-0.5 rounded-full border bg-background hover:bg-muted transition-colors disabled:opacity-50 text-muted-foreground"
            title={wildcardMode ? 'Switch to Optimized mode' : 'Switch to Discovery mode'}
          >
            {wildcardMode ? 'Optimized' : 'Discovery'}
          </button>
          {isStreaming && (
            <button
              onClick={handleStop}
              className="text-xs px-2.5 py-1.5 rounded-lg border bg-background hover:bg-muted transition-colors"
            >
              Stop
            </button>
          )}
          <button
            onClick={handleGenerate}
            disabled={isStreaming}
            className="text-xs px-3 py-1.5 rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50 font-medium"
          >
            {isStreaming ? 'Thinking…' : hasRecs > 0 ? 'Refresh' : 'Get Recommendations'}
          </button>
        </div>
      </div>

      {/* Load error */}
      {fetchError && !loadingPersisted && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {fetchError}
        </div>
      )}

      {/* Stream error */}
      {streamError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {streamError}
        </div>
      )}

      {/* Initial loading skeleton */}
      {loadingPersisted && (
        <div className="rounded-lg border bg-muted/50 p-4 text-xs text-muted-foreground text-center animate-pulse">
          Loading saved recommendations…
        </div>
      )}

      {/* Streaming skeleton (before first streamed rec arrives) */}
      {isStreaming && !streamedResult?.recommendations?.length && (
        <div className="rounded-lg border bg-muted/50 p-4 text-xs text-muted-foreground text-center animate-pulse">
          Generating recommendations…
        </div>
      )}

      {/* Summary banner — persisted */}
      {showPersisted && (persisted?.summary || persisted?.estimatedBracketAfter != null) && (
        <SummaryBanner
          summary={persisted.summary}
          estimatedBracketAfter={persisted.estimatedBracketAfter}
        />
      )}

      {/* Summary banner — streaming */}
      {showStreaming && (streamedResult?.summary || streamedResult?.estimated_bracket_after != null) && (
        <SummaryBanner
          summary={streamedResult.summary ?? null}
          estimatedBracketAfter={streamedResult.estimated_bracket_after}
          priceDeltaCents={streamedResult.estimated_price_delta_cents}
        />
      )}

      {/* Empty state */}
      {!loadingPersisted && !hasContent && !isStreaming && !fetchError && (
        <div className="rounded-lg border border-dashed bg-muted/20 p-8 text-center space-y-2">
          <p className="text-sm font-medium text-foreground">No recommendations yet</p>
          <p className="text-xs text-muted-foreground">
            Click &ldquo;Get Recommendations&rdquo; to have AI analyze your deck and suggest swaps.
          </p>
        </div>
      )}

      {/* Sub-tabs + content */}
      {hasContent && (
        <div className="space-y-3">
          {/* Sub-tab pills */}
          <div className="flex gap-1 border-b pb-2">
            <button
              onClick={() => setActiveTab('cuts')}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTab === 'cuts'
                  ? 'bg-red-100 text-red-800 border border-red-200'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              Cuts
              {showPersisted && visibleCuts.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-red-200 text-red-700 rounded-full px-1.5 py-0.5">
                  {visibleCuts.length}
                </span>
              )}
              {showStreaming && streamedCuts.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-red-200 text-red-700 rounded-full px-1.5 py-0.5">
                  {streamedCuts.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('adds')}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTab === 'adds'
                  ? 'bg-green-100 text-green-800 border border-green-200'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              Adds
              {showPersisted && visibleAdds.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-green-200 text-green-700 rounded-full px-1.5 py-0.5">
                  {visibleAdds.length}
                </span>
              )}
              {showStreaming && streamedAdds.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-green-200 text-green-700 rounded-full px-1.5 py-0.5">
                  {streamedAdds.length}
                </span>
              )}
            </button>
          </div>

          {/* Cuts tab */}
          {activeTab === 'cuts' && (
            <div className="space-y-2">
              {showPersisted && visibleCuts.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No cut suggestions — your deck looks solid!
                </p>
              )}
              {showPersisted && visibleCuts.map((rec) => (
                <PersistedRecCard
                  key={rec.id}
                  rec={rec}
                  deckId={deckId}
                  localStatus={localStatuses[rec.id] ?? null}
                  onStatusChange={handleStatusChange}
                />
              ))}
              {showStreaming && streamedCuts.map((rec, i) => (
                <StreamedRecCard key={`stream-cut-${i}`} rec={rec} />
              ))}
              {showStreaming && streamedCuts.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4 animate-pulse">
                  Analyzing cuts…
                </p>
              )}
            </div>
          )}

          {/* Adds tab */}
          {activeTab === 'adds' && (
            <div className="space-y-2">
              {showPersisted && visibleAdds.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No add suggestions at this time.
                </p>
              )}
              {showPersisted && visibleAdds.map((rec) => (
                <PersistedRecCard
                  key={rec.id}
                  rec={rec}
                  deckId={deckId}
                  localStatus={localStatuses[rec.id] ?? null}
                  onStatusChange={handleStatusChange}
                />
              ))}
              {showStreaming && streamedAdds.map((rec, i) => (
                <StreamedRecCard key={`stream-add-${i}`} rec={rec} />
              ))}
              {showStreaming && streamedAdds.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4 animate-pulse">
                  Analyzing adds…
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
