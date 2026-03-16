'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import type { DeckAnalysis } from '@/lib/ai/schemas'
import { getBracketLabel } from '@/lib/constants/brackets'
import { updateDeckBracket, updateCategoryTargets } from '@/app/(dashboard)/decks/actions'
import { usePollAnalysis } from '@/hooks/use-poll-analysis'
import { toast } from 'sonner'
import { SaltScoreMeter } from '@/components/ai/salt-score-meter'
import { TargetApprovalBanner } from '@/components/ai/target-approval-banner'
import { LandsSection } from '@/components/ai/lands-section'
import { ManaSymbol } from '@/components/ui/mana-symbol'
import { AnalysisTextWithCards } from '@/components/ai/analysis-text-with-cards'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RATING_COLORS: Record<string, string> = {
  deficient: 'text-red-500',
  low: 'text-orange-500',
  adequate: 'text-yellow-500',
  strong: 'text-green-500',
  excessive: 'text-blue-500',
}

const RATING_BG: Record<string, string> = {
  deficient: 'bg-red-500/10',
  low: 'bg-orange-500/10',
  adequate: 'bg-yellow-500/10',
  strong: 'bg-green-500/10',
  excessive: 'bg-blue-500/10',
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full bg-blue-500/70 transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function BracketBadge({ bracket }: { bracket: number }) {
  const colors: Record<number, string> = {
    1: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    2: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    3: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    4: 'bg-red-500/15 text-red-500',
    5: 'bg-purple-500/15 text-purple-500',
  }
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-bold ${colors[bracket] ?? 'bg-muted text-muted-foreground'}`}
    >
      B{bracket}
    </span>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </span>
  )
}

// ─── Sub-sections ─────────────────────────────────────────────────────────────

type NormalizedCategory = { name: string; count: number; target: number; rating: string; cards: string[]; notes: string }

function normalizeCategories(cats: unknown): { core: NormalizedCategory[]; deck_specific: NormalizedCategory[] } {
  if (Array.isArray(cats)) {
    const coreNames = ['Ramp', 'Card Draw', 'Targeted Removal', 'Board Wipes', 'Win Conditions', 'Protection']
    return {
      core: (cats as NormalizedCategory[]).filter((c) => coreNames.includes(c.name)),
      deck_specific: (cats as NormalizedCategory[]).filter((c) => !coreNames.includes(c.name)),
    }
  }
  if (cats && typeof cats === 'object' && 'core' in (cats as object)) {
    return cats as { core: NormalizedCategory[]; deck_specific: NormalizedCategory[] }
  }
  return { core: [], deck_specific: [] }
}

interface CategoryGridProps {
  categories: { core: NormalizedCategory[]; deck_specific: NormalizedCategory[] }
  categoryTargets?: Record<string, number> | null
  suggestedTargets?: Array<{ category: string; target_count: number; reasoning: string }>
  cardNames: string[]
}

function CategoryGrid({ categories, categoryTargets, suggestedTargets, cardNames }: CategoryGridProps) {
  function getTargetLabel(cat: NormalizedCategory): string | null {
    const key = cat.name.toLowerCase().replace(/\s+/g, '_')
    if (categoryTargets && key in categoryTargets) {
      return `Target: ${categoryTargets[key]} (approved)`
    }
    const suggested = suggestedTargets?.find((s) => s.category === key)
    if (suggested) {
      return `Target: ${suggested.target_count} (AI-suggested)`
    }
    if (cat.target > 0) {
      return `Target: ${cat.target} (default)`
    }
    return null
  }

  function renderCategoryCard(cat: NormalizedCategory, i: number) {
    const targetLabel = getTargetLabel(cat)
    return (
      <div key={i} className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{cat.name}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground tabular-nums">
              {cat.count}/{cat.target}
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${RATING_COLORS[cat.rating] ?? ''} ${RATING_BG[cat.rating] ?? ''}`}
            >
              {cat.rating}
            </span>
          </div>
        </div>
        <ProgressBar value={cat.count} max={cat.target > 0 ? cat.target : 1} />
        {targetLabel && (
          <p className="text-[10px] text-muted-foreground/70 font-medium">{targetLabel}</p>
        )}
        {cat.notes && (
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <AnalysisTextWithCards text={cat.notes} cardNames={cardNames} />
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {categories.core.length > 0 && (
        <div className="space-y-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Core Categories</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {categories.core.map((cat, i) => renderCategoryCard(cat, i))}
          </div>
        </div>
      )}
      {categories.deck_specific.length > 0 && (
        <div className="space-y-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Deck-Specific Categories</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {categories.deck_specific.map((cat, i) => renderCategoryCard(cat, i))}
          </div>
        </div>
      )}
    </div>
  )
}

function StrengthsWeaknessesPanel({
  strengths,
  weaknesses,
}: {
  strengths?: string[]
  weaknesses?: string[]
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Strengths */}
      <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4 space-y-3">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-green-500" />
          <SectionLabel>Strengths</SectionLabel>
        </div>
        {strengths && strengths.length > 0 ? (
          <ul className="space-y-2">
            {strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1.5 size-1 rounded-full bg-green-500/60 shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground italic">None identified</p>
        )}
      </div>

      {/* Weaknesses */}
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 space-y-3">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-red-500" />
          <SectionLabel>Weaknesses</SectionLabel>
        </div>
        {weaknesses && weaknesses.length > 0 ? (
          <ul className="space-y-2">
            {weaknesses.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1.5 size-1 rounded-full bg-red-500/60 shrink-0" />
                {w}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground italic">None identified</p>
        )}
      </div>
    </div>
  )
}

// ─── AnalysisTabContent ───────────────────────────────────────────────────────

interface AnalysisTabContentProps {
  deckId: string
  cardCount: number
  targetBracket: number
  categoryTargets: Record<string, number> | null
  onSwitchToRecommendations?: (focus?: string) => void
}

export function AnalysisTabContent({
  deckId,
  cardCount,
  targetBracket,
  categoryTargets,
  onSwitchToRecommendations,
}: AnalysisTabContentProps) {
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null)
  const [acceptingBracket, setAcceptingBracket] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [, startTransition] = useTransition()

  const { data, isPolling, error, trigger } = usePollAnalysis<DeckAnalysis>(deckId, 'full')
  const [selectedHistoryAnalysis, setSelectedHistoryAnalysis] = useState<DeckAnalysis | null>(null)

  const isLoading = isPolling || data?.status === 'pending' || data?.status === 'processing'
  const displayedAnalysis = (selectedHistoryAnalysis ?? data?.results) as DeckAnalysis | undefined

  // Toast on completion — only fires when the user explicitly triggered analysis
  const prevStatusRef = useRef(data?.status)
  const userTriggeredRef = useRef(false)
  useEffect(() => {
    if (userTriggeredRef.current && prevStatusRef.current !== 'complete' && data?.status === 'complete') {
      toast.success('Deck analysis complete!')
      userTriggeredRef.current = false
    }
    prevStatusRef.current = data?.status
  }, [data?.status])

  function handleAnalyze() {
    userTriggeredRef.current = true
    trigger({ deckId })
    setSelectedHistoryId(null)
  }

  async function handleAcceptBracket(bracket: number) {
    setAcceptingBracket(true)
    try {
      await updateDeckBracket(deckId, bracket)
    } finally {
      setAcceptingBracket(false)
    }
  }

  function handleSelectHistory(id: string) {
    const entry = data?.history?.find((h) => h.id === id)
    if (!entry) return
    setSelectedHistoryId(id)
    setHistoryOpen(false)

    // If selecting the most recent (first in history), clear override to show live data
    if (id === data?.history?.[0]?.id) {
      setSelectedHistoryAnalysis(null)
      return
    }

    // History entries now include full results — use directly
    if (entry.results) {
      setSelectedHistoryAnalysis(entry.results as DeckAnalysis)
    }
  }

  // ── Error message ──
  let errorMessage: string | null = null
  if (data?.status === 'failed') {
    errorMessage = data.errorMessage ?? 'Analysis failed. Try again.'
  } else if (error) {
    errorMessage = 'Analysis failed. Try again.'
  }

  const analysis = displayedAnalysis
  const hasResult = !!analysis && Object.keys(analysis).length > 0
  const hasHistory = (data?.history ?? []).length > 0

  // Bracket suggestion logic
  const suggestedBracket = analysis?.bracket
  const bracketDiffers =
    suggestedBracket !== undefined && suggestedBracket !== targetBracket

  // Follow-up action visibility
  const showImproveSynergy =
    hasResult && analysis?.synergy_score !== undefined && analysis.synergy_score < 6
  const showImproveMana =
    hasResult &&
    analysis?.fixing_quality !== undefined &&
    (analysis.fixing_quality === 'poor' || analysis.fixing_quality === 'fair')

  return (
    <div className="space-y-8">
      {/* ── Header bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="size-7 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0">
            <svg
              className="size-4 text-blue-500"
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
          <div>
            <h2 className="text-sm font-semibold">AI Analysis</h2>
            {data?.history?.[0]?.createdAt && !isLoading && (
              <p className="text-[11px] text-muted-foreground">
                Last analyzed: {formatDate(data.history[0].createdAt)}
              </p>
            )}
            {isLoading && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                Analyzing <LoadingDots />
              </p>
            )}
            {!data && !isLoading && !error && (
              <p className="text-[11px] text-muted-foreground">Loading saved analysis…</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* History dropdown */}
          {hasHistory && !isLoading && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setHistoryOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <svg
                  className="size-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                History
                <svg
                  className={`size-3 transition-transform ${historyOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {historyOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
                  {data?.history.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => handleSelectHistory(entry.id)}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-muted transition-colors ${
                        (selectedHistoryId ?? data?.history[0]?.id) === entry.id
                          ? 'bg-muted/60 font-medium'
                          : ''
                      }`}
                    >
                      <span>{formatDate(entry.createdAt)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={cardCount < 10 || isLoading}
            className="rounded bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium px-3 py-1.5 transition-colors"
          >
            {isLoading ? 'Analyzing…' : hasResult ? 'Re-analyze' : 'Analyze Deck'}
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {errorMessage && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3">
          <p className="text-sm text-red-500">{errorMessage}</p>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {isLoading && !hasResult && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[75, 55, 85, 65].map((w, i) => (
              <div
                key={i}
                className="h-24 rounded-lg bg-muted animate-pulse"
                style={{ animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
          <div className="space-y-2.5">
            {[80, 60, 90, 50].map((w, i) => (
              <div
                key={i}
                className="h-2 rounded-full bg-muted animate-pulse"
                style={{ width: `${w}%`, animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Bracket change CTA ── */}
      {hasResult && bracketDiffers && suggestedBracket !== undefined && (
        <div className="rounded-lg border-2 border-amber-500/40 bg-amber-500/5 px-5 py-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 size-5 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
              <svg
                className="size-3 text-amber-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                AI suggests this deck is Bracket {suggestedBracket} —{' '}
                {getBracketLabel(suggestedBracket)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your deck is currently targeting Bracket {targetBracket} (
                {getBracketLabel(targetBracket)}). You can accept the AI suggestion or adjust
                your target.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleAcceptBracket(suggestedBracket)}
              disabled={acceptingBracket}
              className="rounded bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 transition-colors"
            >
              {acceptingBracket ? 'Saving…' : `Accept B${suggestedBracket}`}
            </button>
            {suggestedBracket > targetBracket && onSwitchToRecommendations && (
              <button
                type="button"
                onClick={() => onSwitchToRecommendations('bracket_down')}
                className="rounded border border-border bg-background hover:bg-muted text-xs font-medium px-3 py-1.5 transition-colors"
              >
                Get recommendations to reach B{targetBracket}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {hasResult && analysis && (() => {
        const normalized = normalizeCategories(analysis.categories)
        const allCardNames = [...normalized.core, ...normalized.deck_specific].flatMap((c) => c.cards ?? [])
        return (
        <div className="space-y-8">
          {/* Overall assessment */}
          {analysis.overall_assessment && (
            <div className="rounded-lg border border-border bg-muted/20 px-6 py-5">
              <p className="text-base leading-relaxed text-foreground">
                <AnalysisTextWithCards text={analysis.overall_assessment} cardNames={allCardNames} />
              </p>
            </div>
          )}

          {/* Power level */}
          {analysis.bracket !== undefined && (
            <div className="space-y-3 pb-8 border-b border-zinc-800">
              <h3 className="text-lg font-semibold">Power Level</h3>
              <div className="rounded-lg border border-border bg-card p-5 space-y-3">
                {(() => {
                  const rawConfidence = analysis.bracket_confidence ?? 0
                  const confidence = rawConfidence > 1 ? rawConfidence : Math.round(rawConfidence * 100)
                  return (
                    <div className="flex items-center gap-3">
                      <BracketBadge bracket={analysis.bracket} />
                      <span className="text-sm font-medium">
                        {getBracketLabel(analysis.bracket)}
                      </span>
                      <div className="flex-1">
                        <ProgressBar value={confidence} max={100} />
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {confidence}% confidence
                      </span>
                    </div>
                  )
                })()}
                {analysis.bracket_reasoning && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    <AnalysisTextWithCards text={analysis.bracket_reasoning} cardNames={allCardNames} />
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Target Approval Banner */}
          {analysis.suggested_targets && analysis.suggested_targets.length > 0 && categoryTargets === null && !bannerDismissed && (
            <TargetApprovalBanner
              suggestedTargets={analysis.suggested_targets}
              currentTargets={categoryTargets}
              onAcceptAll={(targets) => {
                startTransition(() => {
                  updateCategoryTargets(deckId, targets)
                })
              }}
              onModify={() => onSwitchToRecommendations?.('details')}
              onDismiss={() => setBannerDismissed(true)}
            />
          )}

          {/* Categories — 2-column grid */}
          {analysis.categories && (normalized.core.length > 0 || normalized.deck_specific.length > 0) && (
            <div className="space-y-3 pb-8 border-b border-zinc-800">
              <h3 className="text-lg font-semibold">Categories</h3>
              <CategoryGrid
                categories={normalized}
                categoryTargets={categoryTargets}
                suggestedTargets={analysis.suggested_targets}
                cardNames={allCardNames}
              />
            </div>
          )}

          {/* Strengths & Weaknesses — side by side */}
          {(analysis.strengths || analysis.weaknesses) && (
            <div className="space-y-3 pb-8 border-b border-zinc-800">
              <h3 className="text-lg font-semibold">Strengths &amp; Weaknesses</h3>
              <StrengthsWeaknessesPanel
                strengths={analysis.strengths}
                weaknesses={analysis.weaknesses}
              />
            </div>
          )}

          {/* Lands Analysis */}
          {displayedAnalysis?.lands_analysis && (
            <div className="space-y-3 pb-8 border-b border-zinc-800">
              <LandsSection
                landsAnalysis={displayedAnalysis.lands_analysis}
                fixingQuality={analysis.fixing_quality}
                deckId={deckId}
                onRecommendDualLands={async () => {
                  try {
                    await fetch('/api/ai/mana-fixing', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ deckId }),
                    })
                    onSwitchToRecommendations?.('mana_base')
                  } catch (err) {
                    console.error('Failed to request mana fixing recommendations', err)
                  }
                }}
                onFillWithBasics={() => {
                  console.log('Fill with basics: not yet implemented', { deckId })
                }}
              />
            </div>
          )}

          {/* Mana base + Synergy — two column */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-8 border-b border-zinc-800">
            {/* Mana Base */}
            {(analysis.land_count !== undefined ||
              analysis.mana_base_notes ||
              analysis.fixing_quality) && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Mana Base</h3>
                <div className="rounded-lg border border-border bg-card p-5 space-y-3">
                  {analysis.land_count !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Land Count</span>
                      <span className="text-sm font-semibold tabular-nums">
                        {analysis.land_count}
                        {analysis.recommended_land_count
                          ? ` / ${analysis.recommended_land_count} rec.`
                          : ''}
                      </span>
                    </div>
                  )}
                  {analysis.fixing_quality && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Fixing Quality</span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          {
                            poor: 'text-red-500 bg-red-500/10',
                            fair: 'text-orange-500 bg-orange-500/10',
                            good: 'text-yellow-500 bg-yellow-500/10',
                            excellent: 'text-green-500 bg-green-500/10',
                          }[analysis.fixing_quality] ?? ''
                        }`}
                      >
                        {analysis.fixing_quality}
                      </span>
                    </div>
                  )}
                  {analysis.lands_analysis?.color_production && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Colors:</span>
                      <div className="flex items-center gap-1">
                        {(['W', 'U', 'B', 'R', 'G'] as const).map((c) => {
                          const count = (analysis.lands_analysis?.color_production as Record<string, number | undefined>)?.[c]
                          if (!count) return null
                          return (
                            <span key={c} className="inline-flex items-center gap-0.5">
                              <ManaSymbol color={c} size="xs" />
                              <span className="text-[10px] text-muted-foreground tabular-nums">{count}</span>
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {analysis.mana_base_notes && (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      <AnalysisTextWithCards text={analysis.mana_base_notes} cardNames={allCardNames} />
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Synergy */}
            {(analysis.synergy_score !== undefined ||
              analysis.key_synergies ||
              analysis.dead_cards) && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Synergy</h3>
                <div className="rounded-lg border border-border bg-card p-5 space-y-3">
                  {analysis.synergy_score !== undefined && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Score</span>
                        <span className="text-sm font-semibold tabular-nums">
                          {analysis.synergy_score}/10
                        </span>
                      </div>
                      <ProgressBar value={analysis.synergy_score} max={10} />
                    </div>
                  )}

                  {analysis.key_synergies && analysis.key_synergies.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Key Synergies
                      </span>
                      {analysis.key_synergies.map((s, i) => (
                        <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                          <AnalysisTextWithCards text={s} cardNames={allCardNames} />
                        </p>
                      ))}
                    </div>
                  )}

                  {analysis.dead_cards && analysis.dead_cards.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Dead Cards
                      </span>
                      {analysis.dead_cards.map((d, i) => (
                        <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                          <AnalysisTextWithCards text={d} cardNames={allCardNames} />
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Salt */}
          {(analysis.salt_total !== undefined || analysis.salt_notes) && (
            <div className="space-y-3 pb-8 border-b border-zinc-800">
              <h3 className="text-lg font-semibold">Salt Assessment</h3>
              <div className="rounded-lg border border-border bg-card p-5 space-y-3">
                {analysis.salt_total !== undefined && (
                  <SaltScoreMeter score={analysis.salt_total} />
                )}
                {analysis.salt_notes && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    <AnalysisTextWithCards text={analysis.salt_notes} cardNames={allCardNames} />
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Follow-up action buttons ── */}
          {(showImproveSynergy || showImproveMana) && onSwitchToRecommendations && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Suggested Next Steps</h3>
              <div className="flex flex-wrap gap-2">
                {showImproveSynergy && (
                  <button
                    type="button"
                    onClick={() => onSwitchToRecommendations('synergy')}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-card hover:bg-muted px-3 py-2 text-xs font-medium transition-colors"
                  >
                    <svg
                      className="size-3.5 text-blue-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
                      />
                    </svg>
                    Improve synergy
                  </button>
                )}
                {showImproveMana && (
                  <button
                    type="button"
                    onClick={() => onSwitchToRecommendations('mana_base')}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-card hover:bg-muted px-3 py-2 text-xs font-medium transition-colors"
                  >
                    <svg
                      className="size-3.5 text-amber-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
                      />
                    </svg>
                    Improve mana base
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        )
      })()}

      {/* ── Empty state ── */}
      {!isLoading && !hasResult && !errorMessage && data !== null && (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <div className="size-12 rounded-full bg-blue-500/10 flex items-center justify-center">
            <svg
              className="size-6 text-blue-500/60"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {cardCount < 10 ? 'Not enough cards' : 'No analysis yet'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {cardCount < 10
                ? `Add ${10 - cardCount} more card${10 - cardCount === 1 ? '' : 's'} to enable analysis`
                : 'Run an AI analysis to get insights on power level, categories, synergy, and more'}
            </p>
          </div>
          {cardCount >= 10 && (
            <button
              type="button"
              onClick={handleAnalyze}
              className="rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 transition-colors"
            >
              Analyze Deck
            </button>
          )}
        </div>
      )}
    </div>
  )
}
