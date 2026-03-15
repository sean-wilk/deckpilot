'use client'

import { ManaCurveChart } from '@/components/deck/mana-curve-chart'
import { ColorChart } from '@/components/deck/color-chart'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DeckPageSidebarProps {
  deckId: string
  deck: {
    format: string
    isPublic: boolean
    budgetLimitCents: number | null
    targetBracket: number
  }
  cardCount: number
  statsCards: { cmc: number | string; colors: string[]; prices: Record<string, string | null> | null }[]
  isOwner: boolean
  onAnalyze: () => void
  onRecommend: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBudget(cents: number): string {
  const dollars = cents / 100
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(dollars)
}

function capitalizeFirst(str: string): string {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

// ─── AI Panel ─────────────────────────────────────────────────────────────────

function AiPanel({
  cardCount,
  onAnalyze,
  onRecommend,
}: {
  cardCount: number
  onAnalyze: () => void
  onRecommend: () => void
}) {
  const threshold = 30
  const isUnlocked = cardCount >= threshold
  const progress = Math.min((cardCount / threshold) * 100, 100)

  if (!isUnlocked) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-md bg-muted flex items-center justify-center">
            <svg className="size-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <span className="text-xs font-medium text-muted-foreground">AI Analysis</span>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Add more cards to unlock AI analysis (need 30+)
        </p>

        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{cardCount} cards</span>
            <span>{threshold} required</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500/50 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="size-6 rounded-md bg-muted flex items-center justify-center">
          <svg className="size-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
        <span className="text-xs font-medium text-muted-foreground">AI Analysis</span>
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={onAnalyze}
          className="w-full rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Analyze Deck
        </button>
        <button
          onClick={onRecommend}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted transition-colors"
        >
          Get Recommendations
        </button>
      </div>
    </div>
  )
}

// ─── Deck Info ─────────────────────────────────────────────────────────────────

function DeckInfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  )
}

// ─── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
      {title}
    </h3>
  )
}

// ─── DeckPageSidebar ──────────────────────────────────────────────────────────

export function DeckPageSidebar({
  deck,
  cardCount,
  statsCards,
  isOwner,
  onAnalyze,
  onRecommend,
}: DeckPageSidebarProps) {
  return (
    <aside className="flex flex-col gap-6 w-full lg:w-auto lg:min-w-[260px] lg:max-w-[320px]">
      {/* AI Panel */}
      {isOwner && (
        <AiPanel cardCount={cardCount} onAnalyze={onAnalyze} onRecommend={onRecommend} />
      )}

      {/* Deck Info */}
      <div>
        <SectionHeader title="Deck Info" />
        <div className="rounded-lg border border-border bg-card px-3 divide-y divide-border sm:text-sm md:text-xs lg:text-xs">
          <DeckInfoRow label="Format" value={capitalizeFirst(deck.format)} />
          <DeckInfoRow
            label="Visibility"
            value={
              <span className={deck.isPublic ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                {deck.isPublic ? 'Public' : 'Private'}
              </span>
            }
          />
          <DeckInfoRow label="Cards" value={`${cardCount} / 100`} />
          {deck.budgetLimitCents !== null && (
            <DeckInfoRow label="Budget" value={formatBudget(deck.budgetLimitCents)} />
          )}
        </div>
      </div>

      {/* Mana Curve */}
      <div className="sm:block md:block">
        <SectionHeader title="Mana Curve" />
        <div className="rounded-lg border border-border bg-card p-3 lg:p-4">
          <ManaCurveChart cards={statsCards} />
        </div>
      </div>

      {/* Color Distribution */}
      <div className="sm:block md:block">
        <SectionHeader title="Color Distribution" />
        <div className="rounded-lg border border-border bg-card p-3 lg:p-4">
          <ColorChart cards={statsCards} />
        </div>
      </div>
    </aside>
  )
}
