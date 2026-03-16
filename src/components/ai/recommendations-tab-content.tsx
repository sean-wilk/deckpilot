'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { TIER_CONFIG, TAG_LABELS } from '@/components/ai/recommendation-card'
import type { RecommendationTier, RecommendationTag } from '@/components/ai/recommendation-card'
import { usePollAnalysis } from '@/hooks/use-poll-analysis'

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
  /** DB stored: true = dismissed */
  dismissed: boolean
  sortOrder: number
}

interface RecommendationsResult {
  analysisId: string
  recommendations: PersistedRecommendation[]
  summary: string | null
  estimatedBracketAfter: number | null
  createdAt: string
}

// Local status overlay (from this session's PATCH calls, not yet refetched)
type LocalStatusMap = Record<string, RecStatus>

// ─── Helpers ───────────────────────────────────────────────────────────────────

function dbAcceptedToStatus(rec: Pick<PersistedRecommendation, 'accepted' | 'dismissed'>): RecStatus {
  if (rec.dismissed === true) return 'dismissed'
  if (rec.accepted === true) return 'accepted'
  if (rec.accepted === false) return 'skipped'
  return null
}

function getCardImageUrl(imageUri: Record<string, string> | null): string | null {
  if (!imageUri) return null
  // Prefer small art crop, then normal, then any key
  return imageUri['small'] ?? imageUri['art_crop'] ?? imageUri['normal'] ?? Object.values(imageUri)[0] ?? null
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
}: {
  summary: string | null
  estimatedBracketAfter: number | null | undefined
}) {
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
  const effectiveStatus = localStatus !== undefined ? localStatus : dbAcceptedToStatus(rec)

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
  const { data, isPolling, error, trigger } = usePollAnalysis<RecommendationsResult>(deckId, 'swap_suggestion')

  // Local status overrides (from PATCH calls this session)
  const [localStatuses, setLocalStatuses] = useState<LocalStatusMap>({})

  // Wildcard / discovery mode
  const [wildcardMode, setWildcardMode] = useState(initialWildcardMode)

  // Sub-tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('cuts')

  // Track previous complete status to fire toast once
  const [toastedAnalysisId, setToastedAnalysisId] = useState<string | null>(null)

  // Fire toast when analysis completes
  const results = data?.results
  const analysisId = results?.analysisId
  if (data?.status === 'complete' && analysisId && analysisId !== toastedAnalysisId) {
    toast.success('Recommendations ready!')
    setToastedAnalysisId(analysisId)
  }

  // ── Status change handler ────────────────────────────────────────────────────

  const handleStatusChange = useCallback((id: string, status: RecStatus) => {
    setLocalStatuses((prev) => ({ ...prev, [id]: status }))
  }, [])

  // ── Trigger new recommendations ──────────────────────────────────────────────

  async function handleGenerate() {
    setLocalStatuses({})
    const body: Record<string, unknown> = { deckId, wildcardMode }
    if (focus) body.focus = focus
    await trigger(body)
  }

  // ── Derive display data ──────────────────────────────────────────────────────

  const isLoading = isPolling || data?.status === 'pending' || data?.status === 'processing'
  const isFailed = data?.status === 'failed'
  const isComplete = data?.status === 'complete'

  const recommendations = results?.recommendations ?? []
  const hasRecs = recommendations.length > 0

  const cuts = recommendations.filter(
    (r) => r.tier === 'must_cut' || r.tier === 'consider_cutting'
  )
  const adds = recommendations.filter(
    (r) => r.tier === 'must_add' || r.tier === 'consider_adding'
  )

  const visibleCuts = cuts.filter((r) => {
    const status = localStatuses[r.id] !== undefined ? localStatuses[r.id] : dbAcceptedToStatus(r)
    return status !== 'dismissed'
  })
  const visibleAdds = adds.filter((r) => {
    const status = localStatuses[r.id] !== undefined ? localStatuses[r.id] : dbAcceptedToStatus(r)
    return status !== 'dismissed'
  })

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
            disabled={isLoading}
            className="text-[10px] px-2 py-0.5 rounded-full border bg-background hover:bg-muted transition-colors disabled:opacity-50 text-muted-foreground"
            title={wildcardMode ? 'Switch to Optimized mode' : 'Switch to Discovery mode'}
          >
            {wildcardMode ? 'Optimized' : 'Discovery'}
          </button>
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="text-xs px-3 py-1.5 rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50 font-medium"
          >
            {isLoading ? 'Thinking…' : hasRecs ? 'Refresh' : 'Get Recommendations'}
          </button>
        </div>
      </div>

      {/* Hook-level error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error.message}
        </div>
      )}

      {/* Analysis failed */}
      {isFailed && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {data?.errorMessage ?? 'Recommendations failed. Please try again.'}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="rounded-lg border bg-muted/50 p-4 text-xs text-muted-foreground text-center animate-pulse">
          Generating recommendations…
        </div>
      )}

      {/* Summary banner */}
      {isComplete && (results?.summary || results?.estimatedBracketAfter != null) && (
        <SummaryBanner
          summary={results.summary}
          estimatedBracketAfter={results.estimatedBracketAfter}
        />
      )}

      {/* Empty state */}
      {!isLoading && !hasRecs && !isFailed && !error && (
        <div className="rounded-lg border border-dashed bg-muted/20 p-8 text-center space-y-2">
          <p className="text-sm font-medium text-foreground">No recommendations yet</p>
          <p className="text-xs text-muted-foreground">
            Click &ldquo;Get Recommendations&rdquo; to have AI analyze your deck and suggest swaps.
          </p>
        </div>
      )}

      {/* Sub-tabs + content */}
      {isComplete && hasRecs && (
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
              {visibleCuts.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-red-200 text-red-700 rounded-full px-1.5 py-0.5">
                  {visibleCuts.length}
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
              {visibleAdds.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-green-200 text-green-700 rounded-full px-1.5 py-0.5">
                  {visibleAdds.length}
                </span>
              )}
            </button>
          </div>

          {/* Cuts tab */}
          {activeTab === 'cuts' && (
            <div className="space-y-2">
              {visibleCuts.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No cut suggestions — your deck looks solid!
                </p>
              )}
              {visibleCuts.map((rec) => (
                <PersistedRecCard
                  key={rec.id}
                  rec={rec}
                  deckId={deckId}
                  localStatus={localStatuses[rec.id] ?? null}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}

          {/* Adds tab */}
          {activeTab === 'adds' && (
            <div className="space-y-2">
              {visibleAdds.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No add suggestions at this time.
                </p>
              )}
              {visibleAdds.map((rec) => (
                <PersistedRecCard
                  key={rec.id}
                  rec={rec}
                  deckId={deckId}
                  localStatus={localStatuses[rec.id] ?? null}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
