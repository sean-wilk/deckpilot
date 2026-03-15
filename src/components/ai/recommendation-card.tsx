'use client'

import { useState, useTransition } from 'react'
import { acceptRecommendation } from '@/app/(dashboard)/decks/[id]/recommendations/actions'

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecommendationTier = 'must_cut' | 'consider_cutting' | 'must_add' | 'consider_adding'
export type RecommendationTag = 'synergy' | 'mana_fix' | 'power_level' | 'budget' | 'salt_reduction' | 'curve'

export interface Recommendation {
  tier: RecommendationTier
  card_out: string | null
  card_in: string | null
  reasoning: string
  impact_summary: string
  tags: RecommendationTag[]
}

// ─── Tier config ──────────────────────────────────────────────────────────────

export const TIER_CONFIG: Record<RecommendationTier, { label: string; color: string; bg: string; border: string }> = {
  must_cut: {
    label: 'Must Cut',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
  },
  consider_cutting: {
    label: 'Consider Cutting',
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
  },
  must_add: {
    label: 'Must Add',
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
  },
  consider_adding: {
    label: 'Consider Adding',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
}

export const TAG_LABELS: Record<RecommendationTag, string> = {
  synergy: 'Synergy',
  mana_fix: 'Mana Fix',
  power_level: 'Power Level',
  budget: 'Budget',
  salt_reduction: 'Salt Reduction',
  curve: 'Curve',
}

// ─── Tag badge ────────────────────────────────────────────────────────────────

export function TagBadge({ tag }: { tag: RecommendationTag }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border">
      {TAG_LABELS[tag]}
    </span>
  )
}

// ─── Recommendation card ──────────────────────────────────────────────────────

export function RecommendationCard({
  rec,
  deckId,
  analysisId,
  onAccepted,
}: {
  rec: Recommendation
  deckId: string
  analysisId: string
  onAccepted: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [accepted, setAccepted] = useState<boolean | null>(null)
  const tierCfg = TIER_CONFIG[rec.tier]

  function handleAccept() {
    startTransition(async () => {
      await acceptRecommendation(deckId, analysisId, rec.card_out, rec.card_in)
      setAccepted(true)
      onAccepted()
    })
  }

  function handleReject() {
    setAccepted(false)
  }

  return (
    <div
      className={`rounded-xl border p-4 space-y-3 transition-opacity ${tierCfg.bg} ${tierCfg.border} ${
        accepted === false ? 'opacity-40' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${tierCfg.color} ${tierCfg.bg} ${tierCfg.border}`}>
            {tierCfg.label}
          </span>
          {accepted === true && (
            <span className="text-xs font-medium text-green-700 bg-green-100 border border-green-200 px-2 py-0.5 rounded-full">
              Accepted
            </span>
          )}
          {accepted === false && (
            <span className="text-xs font-medium text-muted-foreground bg-muted border px-2 py-0.5 rounded-full">
              Skipped
            </span>
          )}
        </div>

        {/* Accept / reject buttons */}
        {accepted === null && (
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={handleReject}
              disabled={isPending}
              className="text-xs px-2.5 py-1 rounded-lg border bg-background hover:bg-muted transition-colors disabled:opacity-50"
            >
              Skip
            </button>
            <button
              onClick={handleAccept}
              disabled={isPending}
              className="text-xs px-2.5 py-1 rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50 font-medium"
            >
              {isPending ? 'Applying…' : 'Accept'}
            </button>
          </div>
        )}
      </div>

      {/* Swap arrow */}
      {(rec.card_out || rec.card_in) && (
        <div className="flex items-center gap-2 text-sm">
          {rec.card_out && (
            <span className="font-medium text-red-800 bg-red-100 border border-red-200 px-2 py-0.5 rounded">
              {rec.card_out}
            </span>
          )}
          {rec.card_out && rec.card_in && (
            <span className="text-muted-foreground">→</span>
          )}
          {rec.card_in && (
            <span className="font-medium text-green-800 bg-green-100 border border-green-200 px-2 py-0.5 rounded">
              {rec.card_in}
            </span>
          )}
        </div>
      )}

      {/* Impact summary */}
      <p className="text-xs font-medium text-foreground">{rec.impact_summary}</p>

      {/* Reasoning */}
      <p className="text-xs text-muted-foreground leading-relaxed">{rec.reasoning}</p>

      {/* Tags */}
      {rec.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {rec.tags.map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </div>
      )}
    </div>
  )
}
