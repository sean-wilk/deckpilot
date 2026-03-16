'use client'

import { CATEGORY_LABELS } from '@/lib/constants/category-defaults'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SuggestedTarget {
  category: string
  target_count: number
  reasoning: string
}

interface TargetApprovalBannerProps {
  suggestedTargets: SuggestedTarget[]
  currentTargets: Record<string, number> | null
  onAcceptAll: (targets: Record<string, number>) => void
  onModify: () => void
  onDismiss: () => void
}

// ─── TargetApprovalBanner ─────────────────────────────────────────────────────

export function TargetApprovalBanner({
  suggestedTargets,
  currentTargets,
  onAcceptAll,
  onModify,
  onDismiss,
}: TargetApprovalBannerProps) {
  // Only render when suggestions exist and no targets have been set yet
  if (!suggestedTargets || suggestedTargets.length === 0 || currentTargets !== null) {
    return null
  }

  function handleAcceptAll() {
    const targets: Record<string, number> = {}
    for (const item of suggestedTargets) {
      targets[item.category] = item.target_count
    }
    onAcceptAll(targets)
  }

  return (
    <div className="rounded-xl border-2 border-indigo-400/60 bg-indigo-500/5 overflow-hidden">
      {/* Accent top bar */}
      <div className="h-0.5 w-full bg-gradient-to-r from-indigo-400 via-blue-400 to-indigo-400" />

      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="size-5 rounded bg-indigo-500/15 flex items-center justify-center shrink-0">
              <svg
                className="size-3 text-indigo-500"
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
              Based on your deck, we recommend these targets:
            </p>
          </div>

          {/* Dismiss button */}
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

        {/* Category grid */}
        <div className="grid grid-cols-2 gap-1.5">
          {suggestedTargets.map((item) => {
            const label = CATEGORY_LABELS[item.category] ?? item.category
            return (
              <div
                key={item.category}
                className="rounded-lg border border-indigo-200/50 dark:border-indigo-800/50 bg-background/60 px-2.5 py-2 space-y-0.5"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-medium text-foreground truncate">
                    {label}
                  </span>
                  <span className="text-[11px] font-bold tabular-nums text-indigo-600 dark:text-indigo-400 shrink-0">
                    {item.target_count}
                  </span>
                </div>
                <p className="text-[9px] text-muted-foreground leading-relaxed line-clamp-2">
                  {item.reasoning}
                </p>
              </div>
            )
          })}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={handleAcceptAll}
            className="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-[11px] font-semibold px-3 py-1.5 transition-colors"
          >
            Accept All
          </button>
          <button
            type="button"
            onClick={onModify}
            className="rounded-lg border border-indigo-400/50 hover:border-indigo-400 hover:bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 text-[11px] font-medium px-3 py-1.5 transition-colors"
          >
            Modify
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted text-[11px] font-medium px-3 py-1.5 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
