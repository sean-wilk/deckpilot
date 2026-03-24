'use client'

import { useState, useCallback, useEffect, useRef, useTransition } from 'react'
import type { StructureStrategy, StructureCategory } from '@/lib/ai/structure-schemas'
import { CATEGORY_LABELS, SENSIBLE_DEFAULTS } from '@/lib/constants/category-defaults'
import { updateCategoryTargets } from '@/app/(dashboard)/decks/actions'
import { AnalysisTextWithCards } from '@/components/ai/analysis-text-with-cards'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StructureTabContentProps {
  deckId: string
  isOwner: boolean
  categoryTargets: Record<string, number> | null
  deckCardNames: string[]
}

type ProgressInfo = {
  currentStep: number
  totalSteps: number
  stepLabel: string
  startedAt: string
  updatedAt: string
} | null

type StructurePollData = {
  status: string
  results: StructureStrategy | null
  errorMessage: string | null
  progress: ProgressInfo
  isPartial: boolean
  history: { id: string; createdAt: string; results?: StructureStrategy | null }[]
} | null

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GRADE_MAP: Record<string, { grade: string; bg: string; text: string }> = {
  excessive: { grade: 'A+', bg: 'bg-info', text: 'text-info-foreground' },
  strong:    { grade: 'A',  bg: 'bg-success', text: 'text-success-foreground' },
  adequate:  { grade: 'B',  bg: 'bg-warning', text: 'text-warning-foreground' },
  low:       { grade: 'C',  bg: 'bg-warning', text: 'text-warning-foreground' },
  deficient: { grade: 'D',  bg: 'bg-error', text: 'text-error-foreground' },
}

const PROGRESS_BAR_COLORS: Record<string, string> = {
  excessive: 'bg-info/70',
  strong:    'bg-success/70',
  adequate:  'bg-warning/70',
  low:       'bg-warning/50',
  deficient: 'bg-error/70',
}

function RatingBadge({ rating }: { rating: string }) {
  const config = GRADE_MAP[rating] ?? { grade: '?', bg: 'bg-muted', text: 'text-muted-foreground' }
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center size-7 rounded-full text-xs font-bold',
        config.bg,
        config.text
      )}
    >
      {config.grade}
    </span>
  )
}

function LoadingDots() {
  return (
    <span className="inline-flex gap-0.5">
      <span className="size-1 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
      <span className="size-1 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
      <span className="size-1 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
    </span>
  )
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── CategoryCard ─────────────────────────────────────────────────────────────

function CategoryCard({
  category,
  cardNames,
}: {
  category: StructureCategory
  cardNames: string[]
}) {
  const barColor = PROGRESS_BAR_COLORS[category.rating] ?? 'bg-interactive/70'
  const target = category.target > 0 ? category.target : 1
  const pct = Math.min((category.currentCount / target) * 100, 100)

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{category.name}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground tabular-nums">
            {category.currentCount}/{category.target}
          </span>
          <RatingBadge rating={category.rating} />
        </div>
      </div>

      {/* Progress bar colored by rating */}
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>

      {category.notes && (
        <p className="text-sm text-muted-foreground leading-relaxed">
          <AnalysisTextWithCards text={category.notes} cardNames={cardNames} />
        </p>
      )}
    </div>
  )
}

// ─── CategoryGrid ─────────────────────────────────────────────────────────────

function CategoryGrid({
  categories,
  cardNames,
}: {
  categories: StructureCategory[]
  cardNames: string[]
}) {
  const core = categories.filter((c) => c.isCore)
  const deckSpecific = categories.filter((c) => !c.isCore)

  return (
    <div className="space-y-4">
      {core.length > 0 && (
        <div className="space-y-2">
          <span className="text-section-label">Core Categories</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {core.map((cat) => (
              <CategoryCard key={cat.slug} category={cat} cardNames={cardNames} />
            ))}
          </div>
        </div>
      )}
      {deckSpecific.length > 0 && (
        <div className="space-y-2">
          <span className="text-section-label">Deck-Specific Categories</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {deckSpecific.map((cat) => (
              <CategoryCard key={cat.slug} category={cat} cardNames={cardNames} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── TargetRecommendationBanner ───────────────────────────────────────────────

interface TargetRecommendationBannerProps {
  results: StructureStrategy
  currentTargets: Record<string, number> | null
  onAcceptAll: (targets: Record<string, number>) => void
  onModify: () => void
  onDismiss: () => void
}

function TargetRecommendationBanner({
  results,
  currentTargets,
  onAcceptAll,
  onModify,
  onDismiss,
}: TargetRecommendationBannerProps) {
  // Build suggested targets from structure results
  const suggestedTargets = results.categories
    .filter((c) => c.isCore)
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      target: c.target,
    }))

  // Check if any suggested targets differ from current
  const hasDifferences = suggestedTargets.some((s) => {
    const current = currentTargets?.[s.slug]
    const defaultVal = SENSIBLE_DEFAULTS[s.slug]
    return current !== s.target && (current !== undefined || s.target !== defaultVal)
  })

  if (!hasDifferences || currentTargets !== null) return null

  function handleAcceptAll() {
    const targets: Record<string, number> = {}
    for (const s of suggestedTargets) {
      targets[s.slug] = s.target
    }
    // Include land target
    targets.lands = results.landTarget
    onAcceptAll(targets)
  }

  return (
    <div className="rounded-xl border-2 border-interactive/60 bg-interactive-muted overflow-hidden">
      <div className="h-0.5 w-full bg-gradient-to-r from-interactive via-interactive/70 to-interactive" />
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="size-5 rounded bg-interactive/15 flex items-center justify-center shrink-0">
              <svg
                className="size-3 text-interactive"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                />
              </svg>
            </div>
            <p className="text-xs font-semibold text-foreground">
              AI suggests these category targets for your deck:
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss suggestions"
            className="shrink-0 size-5 rounded flex items-center justify-center text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted transition-colors"
          >
            <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {suggestedTargets.map((s) => {
            const label = CATEGORY_LABELS[s.slug] ?? s.name
            return (
              <div
                key={s.slug}
                className="rounded-lg border border-interactive/20 bg-background/60 px-2.5 py-2 space-y-0.5"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs-plus font-medium text-foreground truncate">{label}</span>
                  <span className="text-xs-plus font-bold tabular-nums text-interactive shrink-0">
                    {s.target}
                  </span>
                </div>
              </div>
            )
          })}
          {/* Land target */}
          <div className="rounded-lg border border-interactive/20 bg-background/60 px-2.5 py-2 space-y-0.5">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs-plus font-medium text-foreground truncate">Lands</span>
              <span className="text-xs-plus font-bold tabular-nums text-interactive shrink-0">
                {results.landTarget}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={handleAcceptAll}
            className="flex-1 rounded-lg bg-interactive hover:bg-interactive-hover active:bg-interactive-hover text-interactive-foreground text-xs-plus font-semibold px-3 py-1.5 transition-colors"
          >
            Accept All
          </button>
          <button
            type="button"
            onClick={onModify}
            className="rounded-lg border border-interactive/50 hover:border-interactive hover:bg-interactive-muted text-interactive text-xs-plus font-medium px-3 py-1.5 transition-colors"
          >
            Modify
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted text-xs-plus font-medium px-3 py-1.5 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── CustomCategoryInput ──────────────────────────────────────────────────────

function CustomCategoryInput({ deckId, isOwner }: { deckId: string; isOwner: boolean }) {
  const [name, setName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed || isCreating) return
    setIsCreating(true)
    try {
      const res = await fetch(`/api/decks/${deckId}/custom-categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Failed to create category')
      }
      setName('')
      toast.success(`Category "${trimmed}" created`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create category')
    } finally {
      setIsCreating(false)
    }
  }

  if (!isOwner) return null

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">Add Custom Category</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Create a deck-specific category that AI will track alongside the core ones.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="e.g. Sacrifice Outlets, Combo Pieces"
          disabled={isCreating}
          className={cn(
            'flex-1 h-8 rounded-md border border-input bg-transparent px-2.5 text-sm',
            'transition-colors outline-none',
            'placeholder:text-muted-foreground/60',
            'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50',
            'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
            'dark:bg-input/30'
          )}
        />
        <button
          type="button"
          onClick={handleCreate}
          disabled={!name.trim() || isCreating}
          className={cn(
            'shrink-0 rounded bg-interactive hover:bg-interactive-hover active:bg-interactive-hover',
            'text-interactive-foreground text-xs font-medium px-3 h-8 transition-colors',
            'disabled:opacity-40 disabled:cursor-not-allowed'
          )}
        >
          {isCreating ? 'Creating…' : 'Create'}
        </button>
      </div>
    </div>
  )
}

// ─── StructureTabContent ──────────────────────────────────────────────────────

const POLL_INTERVAL = 2000
const POLL_TIMEOUT = 10 * 60 * 1000

export function StructureTabContent({
  deckId,
  isOwner,
  categoryTargets,
  deckCardNames,
}: StructureTabContentProps) {
  const [data, setData] = useState<StructurePollData>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [pollError, setPollError] = useState<Error | null>(null)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [, startTransition] = useTransition()

  const endpoint = `/api/ai/structure/${deckId}`

  // ── Polling ──────────────────────────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsPolling(false)
  }, [])

  const poll = useCallback(async () => {
    try {
      const res = await fetch(endpoint)
      if (!res.ok) throw new Error(`Poll failed: ${res.status}`)
      const json = await res.json()
      setData(json)
      if (json?.status === 'complete' || json?.status === 'failed') {
        stopPolling()
      }
    } catch (err) {
      setPollError(err instanceof Error ? err : new Error(String(err)))
    }
  }, [endpoint, stopPolling])

  // Load on mount
  useEffect(() => {
    poll()
  }, [poll])

  // Resume polling if data shows a pending/processing state on mount
  useEffect(() => {
    if (
      data?.status === 'pending' ||
      data?.status === 'processing'
    ) {
      if (!intervalRef.current) {
        setIsPolling(true)
        intervalRef.current = setInterval(poll, POLL_INTERVAL)
      }
    }
  }, [data?.status, poll])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  // ── Trigger ──────────────────────────────────────────────────────────────

  async function handleRunAnalysis() {
    setPollError(null)
    setIsPolling(true)
    setBannerDismissed(false)

    try {
      const res = await fetch(`/api/ai/structure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deckId }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Trigger failed: ${res.status} ${text}`)
      }
      setData({
        status: 'pending',
        results: null,
        errorMessage: null,
        progress: {
          currentStep: 1,
          totalSteps: 4,
          stepLabel: 'Starting structure analysis…',
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        isPartial: false,
        history: [],
      })
      // Immediate first poll
      setTimeout(poll, 500)
      intervalRef.current = setInterval(poll, POLL_INTERVAL)
      timeoutRef.current = setTimeout(() => {
        stopPolling()
        setPollError(new Error('Analysis timed out after 10 minutes. Please try again.'))
      }, POLL_TIMEOUT)
    } catch (err) {
      setIsPolling(false)
      setPollError(err instanceof Error ? err : new Error(String(err)))
    }
  }

  function handleCancel() {
    stopPolling()
    // Re-fetch current state
    poll()
    toast.info('Structure analysis cancelled')
  }

  // ── Accept targets from banner ────────────────────────────────────────────

  function handleAcceptTargets(targets: Record<string, number>) {
    startTransition(async () => {
      await updateCategoryTargets(deckId, targets)
      toast.success('Category targets updated')
      setBannerDismissed(true)
    })
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const isLoading = isPolling || data?.status === 'pending' || data?.status === 'processing'
  const results = data?.results ?? null
  const hasResult = !!results && results.categories.length > 0

  let errorMessage: string | null = null
  if (data?.status === 'failed') {
    errorMessage = data.errorMessage ?? 'Structure analysis failed. Try again.'
  } else if (pollError) {
    errorMessage = pollError.message
  }

  const showBanner = hasResult && !bannerDismissed && categoryTargets === null

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* ── Header bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="size-7 rounded-md bg-interactive-muted flex items-center justify-center shrink-0">
            <svg
              className="size-4 text-interactive"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Structure Analysis</h2>
            {data?.history?.[0]?.createdAt && !isLoading && (
              <p className="text-xs-plus text-muted-foreground">
                Last analyzed: {formatDate(data.history[0].createdAt)}
              </p>
            )}
            {isLoading && data?.progress && (
              <p className="text-xs-plus text-muted-foreground flex items-center gap-1.5">
                <span>{data.progress.stepLabel}</span>
                <LoadingDots />
              </p>
            )}
            {isLoading && !data?.progress && (
              <p className="text-xs-plus text-muted-foreground flex items-center gap-1">
                Analyzing <LoadingDots />
              </p>
            )}
            {!data && !isLoading && !pollError && (
              <p className="text-xs-plus text-muted-foreground">Loading saved analysis…</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isLoading ? (
            <button
              type="button"
              onClick={handleCancel}
              className="rounded border border-error-border bg-error-muted hover:bg-error-muted/80 text-error text-xs font-medium px-3 py-1.5 transition-colors"
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRunAnalysis}
              disabled={!isOwner}
              className={cn(
                'rounded bg-interactive hover:bg-interactive-hover active:bg-interactive-hover',
                'text-interactive-foreground text-xs font-medium px-3 py-1.5 transition-colors',
                'disabled:opacity-40 disabled:cursor-not-allowed'
              )}
            >
              {hasResult ? 'Re-analyze Structure' : 'Run Structure Analysis'}
            </button>
          )}
        </div>
      </div>

      {/* ── Error ── */}
      {errorMessage && (
        <div className="rounded-lg border border-error-border bg-error-muted px-4 py-3">
          <p className="text-sm text-error">{errorMessage}</p>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {isLoading && !hasResult && (
        <div className="space-y-4">
          {data?.progress ? (
            <div className="rounded-lg border border-interactive/30 bg-interactive-muted/30 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{data.progress.stepLabel}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {data.progress.currentStep}/{data.progress.totalSteps}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-interactive/70 transition-all duration-500"
                  style={{ width: `${Math.round((data.progress.currentStep / data.progress.totalSteps) * 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {[75, 55, 85, 65].map((_, i) => (
                <div
                  key={i}
                  className="h-24 rounded-lg bg-muted animate-pulse"
                  style={{ animationDelay: `${i * 80}ms` }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── No result yet ── */}
      {!hasResult && !isLoading && !errorMessage && (
        <div className="rounded-lg border border-border bg-muted/20 px-6 py-10 text-center space-y-3">
          <div className="mx-auto size-10 rounded-full bg-muted/60 flex items-center justify-center">
            <svg
              className="size-5 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No structure analysis yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Run an analysis to see how well your deck covers the core structural categories.
            </p>
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {hasResult && results && (
        <div className="space-y-6">
          {/* Gap Analysis */}
          {results.gapAnalysis && (
            <div className="rounded-lg border border-warning-border bg-warning-muted p-4 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-warning shrink-0" />
                <span className="text-section-label">Gap Analysis</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                <AnalysisTextWithCards text={results.gapAnalysis} cardNames={deckCardNames} />
              </p>
            </div>
          )}

          {/* Target recommendation banner */}
          {showBanner && (
            <TargetRecommendationBanner
              results={results}
              currentTargets={categoryTargets}
              onAcceptAll={handleAcceptTargets}
              onModify={() => setBannerDismissed(true)}
              onDismiss={() => setBannerDismissed(true)}
            />
          )}

          {/* Summary */}
          {results.summary && (
            <div className="space-y-1.5">
              <span className="text-section-label">Summary</span>
              <p className="text-sm text-muted-foreground leading-relaxed">
                <AnalysisTextWithCards text={results.summary} cardNames={deckCardNames} />
              </p>
            </div>
          )}

          {/* Category grid */}
          {results.categories.length > 0 && (
            <CategoryGrid categories={results.categories} cardNames={deckCardNames} />
          )}
        </div>
      )}

      {/* ── Custom Category creation ── */}
      {isOwner && (
        <CustomCategoryInput deckId={deckId} isOwner={isOwner} />
      )}
    </div>
  )
}
