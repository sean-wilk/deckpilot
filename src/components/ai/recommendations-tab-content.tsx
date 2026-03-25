'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { TIER_CONFIG, TAG_LABELS } from '@/components/ai/recommendation-card'
import type { RecommendationTier, RecommendationTag } from '@/components/ai/recommendation-card'
import { usePollAnalysis } from '@/hooks/use-poll-analysis'
import { AnalysisTextWithCards } from '@/components/ai/analysis-text-with-cards'
import { CardHoverPreview } from '@/components/ui/card-hover-preview'
import { AnalysisProgressBar } from '@/components/ai/analysis-progress-bar'
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'

// ─── Types ─────────────────────────────────────────────────────────────────────

type RecStatus = 'accepted' | 'skipped' | null
type StatusFilter = 'open' | 'skipped' | 'accepted'
type AcceptDestination = 'side' | 'maybe' | 'remove'

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
  /** DB stored: true = dismissed (legacy, no longer set from UI) */
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
  if (rec.dismissed === true) return null // treat legacy dismissed as open
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

// ─── Accept destination dialog ─────────────────────────────────────────────────

function AcceptDialog({
  recommendation,
  open,
  onOpenChange,
  onConfirm,
}: {
  recommendation: { cardOutName: string | null; cardInName: string | null; tier: string }
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (destination: AcceptDestination) => void
}) {
  const [selected, setSelected] = useState<AcceptDestination>('side')

  const hasCardOut = !!recommendation.cardOutName
  const hasCardIn = !!recommendation.cardInName

  const options: { value: AcceptDestination; label: string; description: string }[] = [
    { value: 'side', label: 'Move to Sideboard', description: 'Keep it available for swapping in later' },
    { value: 'maybe', label: 'Move to Maybeboard', description: 'Mark it as a card to reconsider' },
    { value: 'remove', label: 'Remove from deck', description: 'Delete it entirely' },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Accept Recommendation</DialogTitle>

        {hasCardIn && hasCardOut && (
          <DialogDescription>
            <span className="font-medium text-success">{recommendation.cardInName}</span> will be added to your deck.
            Where should <span className="font-medium text-error">{recommendation.cardOutName}</span> go?
          </DialogDescription>
        )}
        {hasCardOut && !hasCardIn && (
          <DialogDescription>
            Where should <span className="font-medium text-error">{recommendation.cardOutName}</span> go?
          </DialogDescription>
        )}

        <div className="space-y-1.5">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelected(opt.value)}
              className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                selected === opt.value
                  ? 'border-foreground bg-muted text-foreground'
                  : 'border-border bg-background hover:bg-muted/50 text-muted-foreground'
              }`}
            >
              <p className={`text-xs font-medium ${selected === opt.value ? 'text-foreground' : ''}`}>
                {opt.label}
              </p>
              <p className="text-2xs text-muted-foreground mt-0.5">{opt.description}</p>
            </button>
          ))}
        </div>

        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="text-xs px-3 py-1.5 rounded-lg border bg-background hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selected)}
            className="text-xs px-3 py-1.5 rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors font-medium"
          >
            Confirm
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Persisted recommendation card ────────────────────────────────────────────

function PersistedRecCard({
  rec,
  deckId,
  localStatus,
  onStatusChange,
  statusFilter,
  selectMode,
  isSelected,
  onToggleSelect,
}: {
  rec: PersistedRecommendation
  deckId: string
  localStatus: RecStatus
  onStatusChange: (id: string, status: RecStatus) => void
  statusFilter: StatusFilter
  selectMode?: boolean
  isSelected?: boolean
  onToggleSelect?: (id: string) => void
}) {
  const [isPending, setIsPending] = useState(false)
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false)
  const tierCfg = TIER_CONFIG[rec.tier]

  // Effective status: local override takes precedence, else from DB
  const effectiveStatus = localStatus !== undefined ? localStatus : dbAcceptedToStatus(rec)

  async function handleSkip() {
    setIsPending(true)
    try {
      const res = await fetch(`/api/ai/recommendations/${deckId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendationId: rec.id, status: 'skipped' }),
      })
      if (res.ok) {
        onStatusChange(rec.id, 'skipped')
      }
    } catch {
      // Non-fatal — leave status unchanged
    } finally {
      setIsPending(false)
    }
  }

  function handleAcceptClick() {
    // Pure adds (no card being removed) — accept immediately without dialog
    if (!rec.cardOutName) {
      handleAcceptConfirm('side') // destination irrelevant for pure adds
      return
    }
    setAcceptDialogOpen(true)
  }

  async function handleAcceptConfirm(destination: AcceptDestination) {
    setAcceptDialogOpen(false)
    setIsPending(true)
    try {
      const res = await fetch(`/api/ai/recommendations/${deckId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendationId: rec.id, status: 'accepted', destination }),
      })
      if (res.ok) {
        onStatusChange(rec.id, 'accepted')
      }
    } catch {
      // Non-fatal — leave status unchanged
    } finally {
      setIsPending(false)
    }
  }

  const isCut = rec.tier === 'must_cut' || rec.tier === 'consider_cutting'

  return (
    <>
      <div
        className={`rounded-xl border p-4 space-y-3 transition-opacity ${tierCfg.bg} ${tierCfg.border} ${
          effectiveStatus === 'skipped' ? 'opacity-50' : ''
        }`}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          {selectMode && (
            <input
              type="checkbox"
              checked={isSelected ?? false}
              onChange={() => onToggleSelect?.(rec.id)}
              className="size-4 rounded border-border accent-primary shrink-0 mt-0.5"
            />
          )}
          <div className="flex items-center gap-2 flex-wrap flex-1">
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
                onClick={handleSkip}
                disabled={isPending}
                className="text-xs px-2.5 py-1 rounded-lg border bg-background hover:bg-muted transition-colors disabled:opacity-50"
              >
                Skip
              </button>
              <button
                onClick={handleAcceptClick}
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
                onClick={handleAcceptClick}
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
                onClick={handleSkip}
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
                <span className="text-muted-foreground text-sm font-light">&rarr;</span>
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
                <span className="text-muted-foreground text-sm font-light">&rarr;</span>
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

      {/* Accept destination dialog */}
      <AcceptDialog
        recommendation={rec}
        open={acceptDialogOpen}
        onOpenChange={setAcceptDialogOpen}
        onConfirm={handleAcceptConfirm}
      />
    </>
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
  const { data, isPolling, error, trigger, cancel } = usePollAnalysis<RecommendationsResult>(deckId, 'swap_suggestion')

  // Local status overrides (from PATCH calls this session)
  const [localStatuses, setLocalStatuses] = useState<LocalStatusMap>({})

  // Sub-tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('cuts')

  // Status filter
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open')

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [bulkAcceptOpen, setBulkAcceptOpen] = useState(false)

  const results = data?.results

  // ── Status change handler ────────────────────────────────────────────────────

  const handleStatusChange = useCallback((id: string, status: RecStatus) => {
    setLocalStatuses((prev) => ({ ...prev, [id]: status }))
  }, [])

  // ── Toggle select ────────────────────────────────────────────────────────────

  function handleToggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── Bulk handlers ────────────────────────────────────────────────────────────

  async function handleBulkSkip() {
    const ids = Array.from(selectedIds)
    try {
      await fetch(`/api/ai/recommendations/${deckId}/bulk-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendationIds: ids, status: 'skipped' }),
      })
      setLocalStatuses(prev => {
        const next = { ...prev }
        for (const id of ids) next[id] = 'skipped'
        return next
      })
      setSelectedIds(new Set())
      setSelectMode(false)
      toast.success(`Skipped ${ids.length} recommendation${ids.length !== 1 ? 's' : ''}`)
    } catch {
      toast.error('Failed to skip recommendations')
    }
  }

  async function handleBulkAcceptConfirm(destination: AcceptDestination) {
    const ids = Array.from(selectedIds)
    setBulkAcceptOpen(false)
    try {
      await fetch(`/api/ai/recommendations/${deckId}/bulk-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendationIds: ids, status: 'accepted', destination }),
      })
      setLocalStatuses(prev => {
        const next = { ...prev }
        for (const id of ids) next[id] = 'accepted'
        return next
      })
      setSelectedIds(new Set())
      setSelectMode(false)
      toast.success(`Accepted ${ids.length} recommendation${ids.length !== 1 ? 's' : ''}`)
    } catch {
      toast.error('Failed to accept recommendations')
    }
  }

  // ── Trigger new recommendations ──────────────────────────────────────────────

  function handleCancel() {
    cancel()
    toast.info('Recommendations cancelled')
  }

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

  // Categorize into cuts / adds
  const cuts = recommendations.filter(
    (r) => r.tier === 'must_cut' || r.tier === 'consider_cutting'
  )
  const adds = recommendations.filter(
    (r) => r.tier === 'must_add' || r.tier === 'consider_adding'
  )

  // Filter by status
  function filterByStatus(recs: PersistedRecommendation[]): PersistedRecommendation[] {
    return recs.filter((r) => {
      const s = getEffectiveStatus(r)
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

  // Total counts for the Cuts/Adds tab badges
  const totalVisibleCuts = cuts.length
  const totalVisibleAdds = adds.length

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
          {isLoading ? (
            <button
              onClick={handleCancel}
              className="text-xs px-3 py-1.5 rounded-lg border border-error-border bg-error-muted hover:bg-error-muted/80 text-error transition-colors font-medium"
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              className="text-xs px-3 py-1.5 rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors font-medium"
            >
              {hasRecs ? 'Refresh' : 'Get Recommendations'}
            </button>
          )}
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
      {isLoading && data?.progress && (
        <div className="rounded-lg border bg-muted/50 p-4">
          <AnalysisProgressBar
            currentStep={data.progress.currentStep}
            totalSteps={data.progress.totalSteps}
            stepLabel={data.progress.stepLabel}
          />
        </div>
      )}
      {isLoading && !data?.progress && (
        <div className="rounded-lg border bg-muted/50 p-4 text-xs text-muted-foreground text-center animate-pulse">
          Generating recommendations...
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

          {/* Status filter pills + Select toggle */}
          <div className="flex items-center gap-1 flex-wrap">
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
            <button
              type="button"
              onClick={() => { setSelectMode(v => !v); setSelectedIds(new Set()) }}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors ml-1',
                selectMode ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {selectMode ? 'Cancel Select' : 'Select'}
            </button>
          </div>

          {/* Cuts tab */}
          {activeTab === 'cuts' && (
            <div className="space-y-2">
              {selectMode && visibleCuts.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const allIds = new Set(visibleCuts.map(r => r.id))
                    setSelectedIds(prev => prev.size === allIds.size && [...allIds].every(id => prev.has(id)) ? new Set() : allIds)
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  {visibleCuts.every(r => selectedIds.has(r.id)) ? 'Deselect All' : 'Select All'}
                </button>
              )}
              {visibleCuts.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-4 space-y-1">
                  {statusFilter === 'open' && (
                    <>
                      <p>No pending cut suggestions</p>
                      {(statusCounts.accepted > 0 || statusCounts.skipped > 0) && (
                        <p className="text-2xs opacity-70">
                          {statusCounts.accepted > 0 && `${statusCounts.accepted} accepted`}
                          {statusCounts.accepted > 0 && statusCounts.skipped > 0 && ' \u00b7 '}
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
                  selectMode={selectMode}
                  isSelected={selectedIds.has(rec.id)}
                  onToggleSelect={handleToggleSelect}
                />
              ))}
            </div>
          )}

          {/* Adds tab */}
          {activeTab === 'adds' && (
            <div className="space-y-2">
              {selectMode && visibleAdds.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const allIds = new Set(visibleAdds.map(r => r.id))
                    setSelectedIds(prev => prev.size === allIds.size && [...allIds].every(id => prev.has(id)) ? new Set() : allIds)
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  {visibleAdds.every(r => selectedIds.has(r.id)) ? 'Deselect All' : 'Select All'}
                </button>
              )}
              {visibleAdds.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-4 space-y-1">
                  {statusFilter === 'open' && (
                    <>
                      <p>No pending add suggestions</p>
                      {(statusCounts.accepted > 0 || statusCounts.skipped > 0) && (
                        <p className="text-2xs opacity-70">
                          {statusCounts.accepted > 0 && `${statusCounts.accepted} accepted`}
                          {statusCounts.accepted > 0 && statusCounts.skipped > 0 && ' \u00b7 '}
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
                  selectMode={selectMode}
                  isSelected={selectedIds.has(rec.id)}
                  onToggleSelect={handleToggleSelect}
                />
              ))}
            </div>
          )}

          {/* Bulk action bar */}
          {selectMode && selectedIds.size > 0 && (
            <div className="sticky bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm px-4 py-3 flex items-center justify-between mt-4 -mx-4 rounded-b-lg">
              <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleBulkSkip}
                  className="rounded border border-border bg-muted px-3 py-1.5 text-xs font-medium hover:bg-muted/80 transition-colors"
                >
                  Skip Selected
                </button>
                <button
                  type="button"
                  onClick={() => setBulkAcceptOpen(true)}
                  className="rounded bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90 transition-colors"
                >
                  Accept Selected
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bulk accept dialog */}
      <Dialog open={bulkAcceptOpen} onOpenChange={setBulkAcceptOpen}>
        <DialogContent>
          <DialogTitle>Accept {selectedIds.size} Recommendation{selectedIds.size !== 1 ? 's' : ''}</DialogTitle>
          <DialogDescription>
            Where should the outgoing cards go?
          </DialogDescription>
          <div className="flex flex-col gap-2 mt-4">
            <button
              onClick={() => handleBulkAcceptConfirm('side')}
              className="w-full text-left px-3 py-2.5 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors"
            >
              <p className="text-xs font-medium">Move to Sideboard</p>
              <p className="text-2xs text-muted-foreground mt-0.5">Keep cards available for swapping in later (recommended)</p>
            </button>
            <button
              onClick={() => handleBulkAcceptConfirm('maybe')}
              className="w-full text-left px-3 py-2.5 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors"
            >
              <p className="text-xs font-medium">Move to Maybeboard</p>
              <p className="text-2xs text-muted-foreground mt-0.5">Mark cards to reconsider later</p>
            </button>
            <button
              onClick={() => handleBulkAcceptConfirm('remove')}
              className="w-full text-left px-3 py-2.5 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors"
            >
              <p className="text-xs font-medium text-destructive">Remove from deck</p>
              <p className="text-2xs text-muted-foreground mt-0.5">Delete cards entirely</p>
            </button>
          </div>
          <DialogFooter>
            <button
              onClick={() => setBulkAcceptOpen(false)}
              className="text-xs px-3 py-1.5 rounded-lg border bg-background hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
