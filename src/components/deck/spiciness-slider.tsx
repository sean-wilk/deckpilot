'use client'

import { useState, useCallback, useRef, useEffect, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { updateDeckSpiciness } from '@/app/(dashboard)/decks/actions'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SpicinessSliderProps {
  deckId: string
  initialValue: number // 0-100
  disabled?: boolean
}

// ─── Tiers ────────────────────────────────────────────────────────────────────

const TIERS = [
  { max: 15,  label: 'Meta Optimal',  color: 'text-blue-400' },
  { max: 35,  label: 'Tuned',         color: 'text-cyan-400' },
  { max: 65,  label: 'Balanced',      color: 'text-purple-400' },
  { max: 85,  label: 'Spicy',         color: 'text-orange-400' },
  { max: 100, label: 'Jank Paradise', color: 'text-red-400' },
] as const

function getTier(value: number) {
  return TIERS.find(t => value <= t.max) ?? TIERS[TIERS.length - 1]
}

// ─── SpicinessSlider ──────────────────────────────────────────────────────────

export function SpicinessSlider({ deckId, initialValue, disabled = false }: SpicinessSliderProps) {
  const [value, setValue] = useState(Math.max(0, Math.min(100, initialValue)))
  const [isPending, startTransition] = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const tier = getTier(value)
  const pct = value // 0-100 maps directly

  // Gradient stop for the filled portion — interpolate blue→purple→orange/red
  const trackGradient =
    'linear-gradient(to right, #3b82f6 0%, #8b5cf6 50%, #f97316 80%, #ef4444 100%)'

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = Number(e.target.value)
      setValue(next)

      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        startTransition(async () => {
          const result = await updateDeckSpiciness(deckId, next)
          if (result && 'error' in result) {
            toast.error(result.error)
          }
        })
      }, 500)
    },
    [deckId],
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <div className={cn('space-y-2.5 w-full', disabled && 'opacity-50')}>
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Spiciness
          </span>
          <span aria-hidden="true">🌶️</span>
        </div>

        {/* Value + tier label */}
        <div className="flex items-baseline gap-1">
          <span className={cn('text-sm font-bold tabular-nums leading-none', tier.color)}>
            {value}
          </span>
          <span className="text-2xs text-muted-foreground">/100</span>
        </div>
      </div>

      {/* Tier label */}
      <div className="flex items-center justify-between">
        <span className={cn('text-xs font-medium', tier.color)}>
          {tier.label}
        </span>
        {isPending && (
          <span className="text-2xs text-muted-foreground/50 animate-pulse">saving…</span>
        )}
      </div>

      {/* Track + thumb */}
      <div className="relative h-5 flex items-center">
        {/* Filled gradient track (behind the input) */}
        <div className="absolute inset-x-0 h-2 rounded-full bg-muted overflow-hidden pointer-events-none">
          <div
            className="h-full rounded-full transition-all duration-150"
            style={{
              width: `${pct}%`,
              background: trackGradient,
              backgroundSize: pct > 0 ? `${(100 / pct) * 100}% 100%` : '100% 100%',
            }}
          />
        </div>

        {/* Native range input — transparent track, custom thumb via CSS */}
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          disabled={disabled}
          onChange={handleChange}
          aria-label={`Deck spiciness: ${value} out of 100 — ${tier.label}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={value}
          aria-valuetext={`${tier.label} (${value}/100)`}
          className={cn(
            'relative w-full h-5 appearance-none bg-transparent cursor-pointer',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded',
            disabled && 'cursor-not-allowed',
            '[&::-webkit-slider-runnable-track]:rounded-full',
            '[&::-webkit-slider-runnable-track]:h-2',
            '[&::-webkit-slider-runnable-track]:bg-transparent',
            '[&::-moz-range-track]:rounded-full',
            '[&::-moz-range-track]:h-2',
            '[&::-moz-range-track]:bg-transparent',
            '[&::-webkit-slider-thumb]:appearance-none',
            '[&::-webkit-slider-thumb]:size-4',
            '[&::-webkit-slider-thumb]:rounded-full',
            '[&::-webkit-slider-thumb]:bg-background',
            '[&::-webkit-slider-thumb]:border-2',
            '[&::-webkit-slider-thumb]:border-border',
            '[&::-webkit-slider-thumb]:shadow-sm',
            '[&::-webkit-slider-thumb]:transition-transform',
            '[&::-webkit-slider-thumb]:hover:scale-110',
            '[&::-moz-range-thumb]:size-4',
            '[&::-moz-range-thumb]:rounded-full',
            '[&::-moz-range-thumb]:bg-background',
            '[&::-moz-range-thumb]:border-2',
            '[&::-moz-range-thumb]:border-border',
            '[&::-moz-range-thumb]:shadow-sm',
          )}
        />
      </div>

      {/* Threshold labels */}
      <div className="flex justify-between text-2xs text-muted-foreground/50 select-none">
        <span>Meta</span>
        <span>Tuned</span>
        <span>Balanced</span>
        <span>Spicy</span>
        <span>Jank</span>
      </div>
    </div>
  )
}
