'use client'

import { useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SaltScoreMeterProps {
  score: number // 0–10
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLabel(score: number): string {
  if (score <= 3) return 'Low Salt'
  if (score <= 5) return 'Moderate'
  if (score <= 7) return 'High Salt'
  return 'Extremely Salty'
}

function getLabelColor(score: number): string {
  if (score <= 3) return 'text-green-600 dark:text-green-400'
  if (score <= 5) return 'text-yellow-600 dark:text-yellow-400'
  if (score <= 7) return 'text-orange-500'
  return 'text-red-500'
}

// ─── SaltScoreMeter ───────────────────────────────────────────────────────────

export function SaltScoreMeter({ score }: SaltScoreMeterProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const clamped = Math.max(0, Math.min(10, score))
  const pct = (clamped / 10) * 100

  return (
    <div className="space-y-1.5 w-full">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Salt Score
          </span>
          {/* Tooltip trigger */}
          <div className="relative">
            <button
              type="button"
              aria-label="Salt score explanation"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onFocus={() => setShowTooltip(true)}
              onBlur={() => setShowTooltip(false)}
              className="size-3.5 rounded-full border border-muted-foreground/40 text-muted-foreground/60 flex items-center justify-center hover:border-muted-foreground/70 hover:text-muted-foreground transition-colors"
            >
              <svg viewBox="0 0 12 12" className="size-2" fill="currentColor">
                <circle cx="6" cy="6" r="5.5" fill="none" stroke="currentColor" strokeWidth="1"/>
                <text x="6" y="9" textAnchor="middle" fontSize="7" fontWeight="bold">?</text>
              </svg>
            </button>

            {showTooltip && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 z-50 w-52 rounded-lg border border-border bg-popover px-3 py-2 shadow-md">
                <p className="text-[10px] text-popover-foreground leading-relaxed">
                  Salt measures how likely your deck is to frustrate opponents — infinite combos, stax pieces, and targeted removal all raise this score.
                </p>
                <div className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-1 overflow-hidden">
                  <div className="w-2 h-2 rotate-45 bg-popover border-r border-b border-border -mt-1 mx-auto" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Numeric value + label */}
        <div className="flex items-baseline gap-1.5">
          <span className={`text-base font-bold tabular-nums leading-none ${getLabelColor(clamped)}`}>
            {clamped % 1 === 0 ? clamped.toFixed(0) : clamped.toFixed(1)}
          </span>
          <span className="text-[10px] text-muted-foreground">/10</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(to right, #22c55e 0%, #eab308 30%, #f97316 60%, #ef4444 100%)',
            backgroundSize: `${pct > 0 ? (100 / pct) * 100 : 100}% 100%`,
          }}
        />
      </div>

      {/* Label */}
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-medium ${getLabelColor(clamped)}`}>
          {getLabel(clamped)}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-muted-foreground/50">Low</span>
          <div className="flex gap-px">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((tick) => (
              <div
                key={tick}
                className={`w-1.5 h-0.5 rounded-full transition-colors ${
                  tick < Math.round(clamped)
                    ? 'bg-foreground/30'
                    : 'bg-muted-foreground/20'
                }`}
              />
            ))}
          </div>
          <span className="text-[9px] text-muted-foreground/50">High</span>
        </div>
      </div>
    </div>
  )
}
