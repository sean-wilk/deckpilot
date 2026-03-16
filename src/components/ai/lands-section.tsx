'use client'

import { useState } from 'react'

// ─── MTG color constants ───────────────────────────────────────────────────────

const MTG_COLORS: Record<string, { label: string; bg: string; bar: string; text: string }> = {
  W: { label: 'White', bg: 'bg-yellow-50 dark:bg-yellow-950/20', bar: 'bg-yellow-400', text: 'text-yellow-700 dark:text-yellow-300' },
  U: { label: 'Blue',  bg: 'bg-blue-50 dark:bg-blue-950/20',     bar: 'bg-blue-500',   text: 'text-blue-700 dark:text-blue-300' },
  B: { label: 'Black', bg: 'bg-neutral-100 dark:bg-neutral-800/40', bar: 'bg-neutral-500', text: 'text-neutral-700 dark:text-neutral-300' },
  R: { label: 'Red',   bg: 'bg-red-50 dark:bg-red-950/20',       bar: 'bg-red-500',    text: 'text-red-700 dark:text-red-300' },
  G: { label: 'Green', bg: 'bg-green-50 dark:bg-green-950/20',   bar: 'bg-green-500',  text: 'text-green-700 dark:text-green-300' },
  C: { label: 'Colorless', bg: 'bg-gray-50 dark:bg-gray-800/40', bar: 'bg-gray-400',   text: 'text-gray-600 dark:text-gray-400' },
}

const WUBRG = ['W', 'U', 'B', 'R', 'G']

const FIXING_QUALITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  poor:      { label: 'Poor',      color: 'text-red-500',    bg: 'bg-red-500/10' },
  fair:      { label: 'Fair',      color: 'text-orange-500', bg: 'bg-orange-500/10' },
  good:      { label: 'Good',      color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  excellent: { label: 'Excellent', color: 'text-green-500',  bg: 'bg-green-500/10' },
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface LandsAnalysis {
  total_lands: number
  target_lands: number
  basic_count: number
  nonbasic_count: number
  color_production?: Partial<Record<string, number>>
  color_requirements?: Partial<Record<string, number>>
  fixing_sources: number
  utility_lands: number
  mana_curve_notes: string
  color_balance_notes: string
  recommendations: string[]
}

interface LandsSectionProps {
  landsAnalysis: LandsAnalysis | null
  fixingQuality: string | undefined
  deckId: string
  onRecommendDualLands?: () => void
  onFillWithBasics?: () => void
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {title}
    </span>
  )
}

function LandCountBar({ total, target }: { total: number; target: number }) {
  const pct = Math.min((total / Math.max(target, 1)) * 100, 100)
  const overTarget = total > target
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">Land Count</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium tabular-nums text-foreground">
            {total}
          </span>
          <span className="text-[10px] text-muted-foreground">/ {target} target</span>
          {overTarget && (
            <span className="text-[10px] px-1 py-0.5 rounded font-medium text-blue-500 bg-blue-500/10">
              +{total - target}
            </span>
          )}
          {total < target && (
            <span className="text-[10px] px-1 py-0.5 rounded font-medium text-orange-500 bg-orange-500/10">
              -{target - total}
            </span>
          )}
        </div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${overTarget ? 'bg-blue-500/60' : 'bg-green-500/60'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span>{total} total</span>
        <span className="text-border">·</span>
        <span>{Math.round(pct)}% of target</span>
      </div>
    </div>
  )
}

function ColorProductionBars({
  production,
  requirements,
}: {
  production: Partial<Record<string, number>>
  requirements?: Partial<Record<string, number>>
}) {
  const activeColors = WUBRG.filter(
    (c) => (production[c] ?? 0) > 0 || (requirements?.[c] ?? 0) > 0
  )

  if (activeColors.length === 0) return null

  const maxVal = Math.max(
    ...activeColors.flatMap((c) => [production[c] ?? 0, requirements?.[c] ?? 0])
  )

  return (
    <div className="space-y-2">
      {activeColors.map((c) => {
        const cfg = MTG_COLORS[c] ?? MTG_COLORS.C
        const prod = production[c] ?? 0
        const req = requirements?.[c] ?? 0
        const prodPct = Math.min((prod / Math.max(maxVal, 1)) * 100, 100)
        const reqPct = Math.min((req / Math.max(maxVal, 1)) * 100, 100)
        const sufficient = prod >= req

        return (
          <div key={c} className="space-y-0.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-bold w-3 ${cfg.text}`}>{c}</span>
                <span className="text-[10px] text-muted-foreground">{cfg.label}</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] tabular-nums">
                <span className="text-foreground font-medium">{prod} src</span>
                {req > 0 && (
                  <>
                    <span className="text-border">·</span>
                    <span className={sufficient ? 'text-green-500' : 'text-orange-500'}>
                      {req} pip{req !== 1 ? 's' : ''}
                    </span>
                    {!sufficient && (
                      <span className="text-orange-500 font-semibold">!</span>
                    )}
                  </>
                )}
              </div>
            </div>
            {/* Production bar */}
            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${cfg.bar}`}
                style={{ width: `${prodPct}%` }}
              />
            </div>
            {/* Requirements bar (when present) */}
            {req > 0 && (
              <div className="h-0.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 opacity-50 ${sufficient ? 'bg-green-500' : 'bg-orange-500'}`}
                  style={{ width: `${reqPct}%` }}
                />
              </div>
            )}
          </div>
        )
      })}
      {requirements && Object.keys(requirements).length > 0 && (
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-0.5">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-1 rounded-full bg-blue-500/60" />
            Sources
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 rounded-full bg-green-500/50" />
            Pips required
          </span>
        </div>
      )}
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[11px] font-medium tabular-nums text-foreground">{value}</span>
    </div>
  )
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-2 text-left"
      >
        <SectionHeader title={title} />
        <svg
          className={`size-3 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="pb-3 space-y-2">{children}</div>}
    </div>
  )
}

// ─── LandsSection ─────────────────────────────────────────────────────────────

export function LandsSection({
  landsAnalysis,
  fixingQuality,
  // deckId reserved for future land-specific queries
  onRecommendDualLands,
  onFillWithBasics,
}: LandsSectionProps) {
  if (!landsAnalysis) return null

  const {
    total_lands,
    target_lands,
    basic_count,
    nonbasic_count,
    color_production,
    color_requirements,
    fixing_sources,
    utility_lands,
    mana_curve_notes,
    color_balance_notes,
    recommendations,
  } = landsAnalysis

  const fixingCfg = fixingQuality
    ? (FIXING_QUALITY_CONFIG[fixingQuality] ?? null)
    : null

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="size-5 rounded bg-green-500/10 flex items-center justify-center">
            <svg
              className="size-3 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5"
              />
            </svg>
          </div>
          <span className="text-xs font-semibold">Lands Analysis</span>
        </div>
        {fixingCfg && (
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${fixingCfg.color} ${fixingCfg.bg}`}
          >
            {fixingCfg.label} Fixing
          </span>
        )}
      </div>

      <div className="divide-y divide-border">
        {/* Land count + progress */}
        <div className="px-4 py-3">
          <LandCountBar total={total_lands} target={target_lands} />
        </div>

        {/* Composition stats */}
        <CollapsibleSection title="Composition" defaultOpen>
          <div className="space-y-1.5">
            <StatRow label="Basic Lands" value={basic_count} />
            <StatRow label="Nonbasic Lands" value={nonbasic_count} />
            <StatRow label="Fixing Sources" value={fixing_sources} />
            <StatRow label="Utility Lands" value={utility_lands} />
          </div>
        </CollapsibleSection>

        {/* Color production */}
        {color_production && Object.keys(color_production).length > 0 && (
          <CollapsibleSection title="Color Production" defaultOpen>
            <ColorProductionBars
              production={color_production}
              requirements={color_requirements}
            />
          </CollapsibleSection>
        )}

        {/* Notes */}
        {(mana_curve_notes || color_balance_notes) && (
          <CollapsibleSection title="Notes" defaultOpen>
            <div className="space-y-2">
              {mana_curve_notes && (
                <div className="space-y-0.5">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    Mana Curve
                  </span>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {mana_curve_notes}
                  </p>
                </div>
              )}
              {color_balance_notes && (
                <div className="space-y-0.5">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    Color Balance
                  </span>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {color_balance_notes}
                  </p>
                </div>
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* Recommendations list */}
        {recommendations && recommendations.length > 0 && (
          <CollapsibleSection title="Recommendations" defaultOpen>
            <ul className="space-y-1.5">
              {recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground leading-relaxed">
                  <span className="mt-1 size-1.5 rounded-full bg-green-500/50 shrink-0" />
                  {rec}
                </li>
              ))}
            </ul>
          </CollapsibleSection>
        )}

        {/* Action buttons */}
        {(onRecommendDualLands || onFillWithBasics) && (
          <div className="px-4 py-3 flex items-center gap-2">
            {onRecommendDualLands && (
              <button
                type="button"
                onClick={onRecommendDualLands}
                className="flex-1 rounded bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-[11px] font-medium px-3 py-1.5 transition-colors"
              >
                Recommend Dual Lands
              </button>
            )}
            {onFillWithBasics && (
              <button
                type="button"
                onClick={onFillWithBasics}
                className="flex-1 rounded border border-border hover:bg-muted active:bg-muted/70 text-foreground text-[11px] font-medium px-3 py-1.5 transition-colors"
              >
                Fill with Basics
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
