'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { TIER_CONFIG, TAG_LABELS } from '@/components/ai/recommendation-card'
import type { RecommendationTier, RecommendationTag } from '@/components/ai/recommendation-card'
import { usePollAnalysis } from '@/hooks/use-poll-analysis'
import { AnalysisTextWithCards } from '@/components/ai/analysis-text-with-cards'
import { CardHoverPreview } from '@/components/ui/card-hover-preview'

// ─── Types ─────────────────────────────────────────────────────────────────────

type RecStatus = 'accepted' | 'skipped' | 'dismissed' | null
type StatusFilter = 'open' | 'skipped' | 'accepted'

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
  const borderClass = variant === 'cut' ? 'border-error/60' : 'border-success/60'
  const ringClass = variant === 'cut' ? 'ring-error/30' : 'ring-success/30'

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
      {summary && <p className="text-sm text-foreground leading-relaxed"><AnalysisTextWithCards text={summary} cardNames={[]} /></p>}
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
  statusFilter,
}: {
  rec: PersistedRecommendation
  deckId: string
  localStatus: RecStatus
  onStatusChange: (id: string, status: RecStatus) => void
  statusFilter: StatusFilter
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
            <span className="text-xs font-medium text-success bg-success-muted border border-success-border px-2 py-0.5 rounded-full">
              Accepted
            </span>
          )}
          {effectiveStatus === 'skipped' && (
            <span className="text-xs font-medium text-muted-foreground bg-muted border px-2 py-0.5 rounded-full">
              Skipped
            </span>
          )}
        </div>

        {/* Action buttons — vary by status filter view */}
        {statusFilter === 'open' && effectiveStatus === null && (
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
              {isPending ? 'Applying...' : 'Accept'}
            </button>
          </div>
        )}
        {statusFilter === 'skipped' && effectiveStatus === 'skipped' && (
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={() => handleStatus('accepted')}
              disabled={isPending}
              className="text-xs px-2.5 py-1 rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50 font-medium"
            >
              {isPending ? 'Applying...' : 'Accept'}
            </button>
          </div>
        )}
        {statusFilter === 'accepted' && effectiveStatus === 'accepted' && (
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={() => handleStatus('skipped')}
              disabled={isPending}
              className="text-xs px-2.5 py-1 rounded-lg border bg-background hover:bg-muted transition-colors disabled:opacity-50 text-warning"
            >
              {isPending ? 'Reversing...' : 'Undo'}
            </button>
          </div>
        )}
      </div>

      {/* Card images + swap arrow */}
      <div className="flex items-center gap-3">
        {isCut ? (
          <>
            {rec.cardOutName && (
              <CardHoverPreview cardName={rec.cardOutName}>
                <div className="cursor-pointer">
                  <CardImage imageUri={rec.cardOutImageUri} cardName={rec.cardOutName} variant="cut" />
                </div>
              </CardHoverPreview>
            )}
            {rec.cardOutName && rec.cardInName && (
              <span className="text-muted-foreground text-sm font-light">→</span>
            )}
            {rec.cardInName && (
              <CardHoverPreview cardName={rec.cardInName}>
                <div className="cursor-pointer">
                  <CardImage imageUri={rec.cardInImageUri} cardName={rec.cardInName} variant="add" />
                </div>
              </CardHoverPreview>
            )}
          </>
        ) : (
          <>
            {rec.cardInName && (
              <CardHoverPreview cardName={rec.cardInName}>
                <div className="cursor-pointer">
                  <CardImage imageUri={rec.cardInImageUri} cardName={rec.cardInName} variant="add" />
                </div>
              </CardHoverPreview>
            )}
            {rec.cardOutName && rec.cardInName && (
              <span className="text-muted-foreground text-sm font-light">→</span>
            )}
            {rec.cardOutName && (
              <CardHoverPreview cardName={rec.cardOutName}>
                <div className="cursor-pointer">
                  <CardImage imageUri={rec.cardOutImageUri} cardName={rec.cardOutName} variant="cut" />
                </div>
              </CardHoverPreview>
            )}
          </>
        )}

        {/* Names beside images */}
        <div className="flex-1 min-w-0 space-y-1">
          {rec.cardOutName && (
            <p className="text-xs">
              <span className="font-medium text-error bg-error-muted border border-error-border px-1.5 py-0.5 rounded">
                {rec.cardOutName}
              </span>
            </p>
          )}
          {rec.cardInName && (
            <p className="text-xs">
              <span className="font-medium text-success bg-success-muted border border-success-border px-1.5 py-0.5 rounded">
                {rec.cardInName}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Impact summary */}
      <p className="text-xs font-medium text-foreground"><AnalysisTextWithCards text={rec.impactSummary} cardNames={[]} /></p>

      {/* Reasoning */}
      <p className="text-xs text-muted-foreground leading-relaxed"><AnalysisTextWithCards text={rec.reasoning} cardNames={[]} /></p>

      {/* Tags */}
      {Array.isArray(rec.tags) && rec.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {rec.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-medium bg-muted text-muted-foreground border"
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

function getTierLabel(spiciness: number): string {
  if (spiciness <= 15) return 'Meta Optimal'
  if (spiciness <= 35) return 'Tuned'
  if (spiciness <= 65) return 'Balanced'
  if (spiciness <= 85) return 'Spicy'
  return 'Jank Paradise'
}

interface RecommendationsTabContentProps {
  deckId: string
  cardCount: number
  focus?: string
  spiciness?: number
}

type ActiveTab = 'cuts' | 'adds'

export function RecommendationsTabContent({
  deckId,
  cardCount,
  focus,
  spiciness = 30,
}: RecommendationsTabContentProps) {
  const { data, isPolling, error, trigger } = usePollAnalysis<RecommendationsResult>(deckId, 'swap_suggestion')

  // Local status overrides (from PATCH calls this session)
  const [localStatuses, setLocalStatuses] = useState<LocalStatusMap>({})

  // Sub-tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('cuts')

  // Status filter
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open')

  // Track previous complete status to fire toast once
  const [toastedAnalysisId, setToastedAnalysisId] = useState<string | null>(null)

  // Fire toast when analysis completes
  const results = data?.results
  const analysisId = results?.analysisId
  if (data?.status === 'complete' && analysisId && analysisId !== toastedAnalysisId) {
    toast.success('Recommendations ready!')
    setToastedAnalysisId(analysisId)
    setStatusFilter('open')
  }

  // ── Status change handler ────────────────────────────────────────────────────

  const handleStatusChange = useCallback((id: string, status: RecStatus) => {
    setLocalStatuses((prev) => ({ ...prev, [id]: status }))
  }, [])

  // ── Trigger new recommendations ──────────────────────────────────────────────

  async function handleGenerate() {
    setLocalStatuses({})
    setStatusFilter('open')
    const body: Record<string, unknown> = { deckId, spiciness }
    if (focus) body.focus = focus
    await trigger(body)
  }

  // ── Derive display data ──────────────────────────────────────────────────────

  const isLoading = isPolling || data?.status === 'pending' || data?.status === 'processing'
  const isFailed = data?.status === 'failed'
  const isComplete = data?.status === 'complete'

  const recommendations = results?.recommendations ?? []
  const hasRecs = recommendations.length > 0

  // Helper to get effective status for a recommendation
  function getEffectiveStatus(r: PersistedRecommendation): RecStatus {
    return localStatuses[r.id] !== undefined ? localStatuses[r.id] : dbAcceptedToStatus(r)
  }

  // Categorize into cuts / adds (excluding dismissed)
  const cuts = recommendations.filter(
    (r) => r.tier === 'must_cut' || r.tier === 'consider_cutting'
  )
  const adds = recommendations.filter(
    (r) => r.tier === 'must_add' || r.tier === 'consider_adding'
  )

  // Filter by status (dismissed are always hidden)
  function filterByStatus(recs: PersistedRecommendation[]): PersistedRecommendation[] {
    return recs.filter((r) => {
      const s = getEffectiveStatus(r)
      if (s === 'dismissed') return false
      if (statusFilter === 'open') return s === null
      if (statusFilter === 'skipped') return s === 'skipped'
      if (statusFilter === 'accepted') return s === 'accepted'
      return true
    })
  }

  const visibleCuts = filterByStatus(cuts)
  const visibleAdds = filterByStatus(adds)

  // Counts per status for the active Cuts/Adds tab
  const activeRecs = activeTab === 'cuts' ? cuts : adds
  const statusCounts = {
    open: activeRecs.filter((r) => { const s = getEffectiveStatus(r); return s === null }).length,
    skipped: activeRecs.filter((r) => { const s = getEffectiveStatus(r); return s === 'skipped' }).length,
    accepted: activeRecs.filter((r) => { const s = getEffectiveStatus(r); return s === 'accepted' }).length,
  }

  // Total non-dismissed counts for the Cuts/Adds tab badges
  const totalVisibleCuts = cuts.filter((r) => getEffectiveStatus(r) !== 'dismissed').length
  const totalVisibleAdds = adds.filter((r) => getEffectiveStatus(r) !== 'dismissed').length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-subsection-heading">AI Recommendations</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {cardCount} card{cardCount !== 1 ? 's' : ''}
            {focus ? ` · Focus: ${focus}` : ''}
            {' · '}Swap suggestions powered by AI
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Read-only spiciness badge */}
          <span className="text-xs text-muted-foreground">
            Creativity: {getTierLabel(spiciness)} ({spiciness}/100)
          </span>
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
        <div className="rounded-lg border border-error-border bg-error-muted p-3 text-xs text-error">
          {error.message}
        </div>
      )}

      {/* Analysis failed */}
      {isFailed && (
        <div className="rounded-lg border border-error-border bg-error-muted p-3 text-xs text-error">
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
                  ? 'bg-error-muted text-error border border-error-border'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              Cuts
              {totalVisibleCuts > 0 && (
                <span className="ml-1.5 text-2xs bg-error-muted text-error rounded-full px-1.5 py-0.5">
                  {totalVisibleCuts}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('adds')}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTab === 'adds'
                  ? 'bg-success-muted text-success border border-success-border'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              Adds
              {totalVisibleAdds > 0 && (
                <span className="ml-1.5 text-2xs bg-success-muted text-success rounded-full px-1.5 py-0.5">
                  {totalVisibleAdds}
                </span>
              )}
            </button>
          </div>

          {/* Status filter pills */}
          <div className="flex items-center gap-1">
            {(['open', 'skipped', 'accepted'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === status
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
                {statusCounts[status] > 0 && (
                  <span className="ml-1 text-2xs opacity-70">{statusCounts[status]}</span>
                )}
              </button>
            ))}
          </div>

          {/* Cuts tab */}
          {activeTab === 'cuts' && (
            <div className="space-y-2">
              {visibleCuts.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-4 space-y-1">
                  {statusFilter === 'open' && (
                    <>
                      <p>No pending cut suggestions</p>
                      {(statusCounts.accepted > 0 || statusCounts.skipped > 0) && (
                        <p className="text-2xs opacity-70">
                          {statusCounts.accepted > 0 && `${statusCounts.accepted} accepted`}
                          {statusCounts.accepted > 0 && statusCounts.skipped > 0 && ' · '}
                          {statusCounts.skipped > 0 && `${statusCounts.skipped} skipped`}
                        </p>
                      )}
                    </>
                  )}
                  {statusFilter === 'skipped' && <p>No skipped cut suggestions</p>}
                  {statusFilter === 'accepted' && <p>No accepted cut suggestions yet</p>}
                </div>
              )}
              {visibleCuts.map((rec) => (
                <PersistedRecCard
                  key={rec.id}
                  rec={rec}
                  deckId={deckId}
                  localStatus={localStatuses[rec.id] ?? null}
                  onStatusChange={handleStatusChange}
                  statusFilter={statusFilter}
                />
              ))}
            </div>
          )}

          {/* Adds tab */}
          {activeTab === 'adds' && (
            <div className="space-y-2">
              {visibleAdds.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-4 space-y-1">
                  {statusFilter === 'open' && (
                    <>
                      <p>No pending add suggestions</p>
                      {(statusCounts.accepted > 0 || statusCounts.skipped > 0) && (
                        <p className="text-2xs opacity-70">
                          {statusCounts.accepted > 0 && `${statusCounts.accepted} accepted`}
                          {statusCounts.accepted > 0 && statusCounts.skipped > 0 && ' · '}
                          {statusCounts.skipped > 0 && `${statusCounts.skipped} skipped`}
                        </p>
                      )}
                    </>
                  )}
                  {statusFilter === 'skipped' && <p>No skipped add suggestions</p>}
                  {statusFilter === 'accepted' && <p>No accepted add suggestions yet</p>}
                </div>
              )}
              {visibleAdds.map((rec) => (
                <PersistedRecCard
                  key={rec.id}
                  rec={rec}
                  deckId={deckId}
                  localStatus={localStatuses[rec.id] ?? null}
                  onStatusChange={handleStatusChange}
                  statusFilter={statusFilter}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
