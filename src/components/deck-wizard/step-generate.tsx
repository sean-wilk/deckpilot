'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  Info,
  Loader2,
  Save,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { CardHoverPreview } from '@/components/ui/card-hover-preview'
import { useDeckGeneration } from '@/hooks/use-deck-generation'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WizardState {
  commander: { id: string; name: string; colorIdentity: string[] } | null
  theme: string
  name: string
  description: string
  bracket: number | null
  budget: string
  spiciness: number
}

interface StepGenerateProps {
  state: WizardState
  onBack: () => void
}

// ─── Category badge colors ────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  land:       'bg-green-500/15 text-green-400 border-green-500/30',
  creature:   'bg-blue-500/15 text-blue-400 border-blue-500/30',
  removal:    'bg-red-500/15 text-red-400 border-red-500/30',
  ramp:       'bg-amber-500/15 text-amber-400 border-amber-500/30',
  draw:       'bg-purple-500/15 text-purple-400 border-purple-500/30',
  tutor:      'bg-pink-500/15 text-pink-400 border-pink-500/30',
  wipe:       'bg-orange-500/15 text-orange-400 border-orange-500/30',
  combo:      'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  enchantment:'bg-violet-500/15 text-violet-400 border-violet-500/30',
  artifact:   'bg-zinc-400/15 text-zinc-300 border-zinc-400/30',
  planeswalker:'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
}

function categoryColor(category: string): string {
  const key = category?.toLowerCase()
  return CATEGORY_COLORS[key] ?? 'bg-muted/60 text-muted-foreground border-border'
}

// ─── CategoryBadge ────────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none shrink-0',
        categoryColor(category)
      )}
    >
      {category}
    </span>
  )
}

// ─── ProgressBar ─────────────────────────────────────────────────────────────

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div className="w-full rounded-full bg-muted h-2 overflow-hidden">
      <div
        className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ─── BracketReasoningPanel ────────────────────────────────────────────────────

function BracketReasoningPanel({
  bracket,
  reasoning,
}: {
  bracket: number
  reasoning: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 animate-in fade-in duration-300">
      <Info className="size-4 text-blue-400 shrink-0 mt-0.5" />
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">
            Bracket Assessment
          </span>
          <span className="inline-flex items-center rounded-full border border-blue-500/40 bg-blue-500/20 px-2 py-0.5 text-xs font-bold text-blue-300 leading-none">
            Bracket {bracket}
          </span>
        </div>
        <p className="text-sm text-blue-200/80 leading-relaxed">{reasoning}</p>
      </div>
    </div>
  )
}

// ─── CardGridItem ─────────────────────────────────────────────────────────────

function CardGridItem({
  name,
  category,
  reasoning,
}: {
  name: string
  category: string
  reasoning: string
}) {
  return (
    <div
      title={reasoning}
      className={cn(
        'flex flex-col gap-1.5 rounded-xl border border-border bg-card px-3 py-2.5',
        'animate-in fade-in duration-300 hover:border-foreground/20 transition-colors cursor-pointer'
      )}
    >
      <p className="text-sm font-medium leading-snug line-clamp-2">{name}</p>
      <CategoryBadge category={category} />
    </div>
  )
}

// ─── StepGenerate ─────────────────────────────────────────────────────────────

export function StepGenerate({ state, onBack }: StepGenerateProps) {
  const router = useRouter()
  const hasStarted = useRef(false)

  const {
    cards,
    bracketReasoning,
    strategySummary,
    isGenerating,
    error,
    totalCards,
    phase,
    phaseMax,
    generate,
    abort,
  } = useDeckGeneration()

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveWarning, setSaveWarning] = useState<string | null>(null)
  const [decklistOpen, setDecklistOpen] = useState(false)

  // Auto-start generation on mount
  useEffect(() => {
    if (hasStarted.current) return
    if (!state.commander) return
    hasStarted.current = true

    generate({
      commanderId: state.commander.id,
      description: state.description || state.theme || '',
      targetBracket: state.bracket ?? 3,
      budgetLimitCents: state.budget
        ? (() => {
            const cents = Math.round(parseFloat(state.budget) * 100)
            return Number.isFinite(cents) ? cents : undefined
          })()
        : undefined,
      spiciness: state.spiciness ?? 30,
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const isComplete = !isGenerating && !error && totalCards > 0
  const isPartial = isComplete && totalCards < 99

  async function handleSave() {
    if (!state.commander) return
    setSaveError(null)
    setIsSaving(true)

    try {
      const res = await fetch('/api/decks/generate-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commanderId: state.commander.id,
          name: state.name,
          description: state.description || strategySummary,
          targetBracket: state.bracket,
          budgetLimitCents: state.budget
            ? (() => {
                const cents = Math.round(parseFloat(state.budget) * 100)
                return Number.isFinite(cents) ? cents : undefined
              })()
            : undefined,
          spiciness: state.spiciness ?? 30,
          cards: cards.map((c) => ({
            name: c.name,
            category: c.category,
            reasoning: c.reasoning,
          })),
          strategySummary,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? `Save failed (${res.status})`)
      }

      const result = await res.json()
      // Show warnings if cards were dropped
      const warnings: string[] = []
      if (result.missingCards?.length > 0) {
        warnings.push(`${result.missingCards.length} cards not found: ${result.missingCards.slice(0, 5).join(', ')}${result.missingCards.length > 5 ? '...' : ''}`)
      }
      if (result.colorViolations?.length > 0) {
        warnings.push(`${result.colorViolations.length} cards removed for color identity: ${result.colorViolations.slice(0, 5).join(', ')}${result.colorViolations.length > 5 ? '...' : ''}`)
      }
      if (warnings.length > 0) {
        setSaveWarning(warnings.join('. '))
        setTimeout(() => router.push(`/decks/${result.deckId}`), 3000)
      } else {
        router.push(`/decks/${result.deckId}`)
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save deck.')
      setIsSaving(false)
    }
  }

  function handleRetry() {
    if (!state.commander) return
    generate({
      commanderId: state.commander.id,
      description: state.description || state.theme || '',
      targetBracket: state.bracket ?? 3,
      budgetLimitCents: state.budget
        ? (() => {
            const cents = Math.round(parseFloat(state.budget) * 100)
            return Number.isFinite(cents) ? cents : undefined
          })()
        : undefined,
      spiciness: state.spiciness ?? 30,
    })
  }

  return (
    <div className="space-y-6">
      {/* Bracket reasoning — arrives first from stream */}
      {bracketReasoning && (
        <BracketReasoningPanel
          bracket={bracketReasoning.bracket}
          reasoning={bracketReasoning.reasoning}
        />
      )}

      {/* Strategy summary — appears after bracket reasoning, before decklist */}
      {strategySummary && (
        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle className="text-sm font-semibold">Strategy</CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {strategySummary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Progress header */}
      {(isGenerating || totalCards > 0) && (
        <div className="space-y-2">
          {isGenerating && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {phase <= 1
                  ? `Generating non-land cards... ${Math.min(totalCards, phaseMax.nonLands)}/${phaseMax.nonLands}`
                  : `Generating land base... ${Math.max(0, totalCards - phaseMax.nonLands)}/${phaseMax.lands}`
                }
              </span>
              <span className="text-muted-foreground">
                {totalCards}/99
              </span>
            </div>
          )}
          {!isGenerating && totalCards > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{totalCards}/99 cards generated</span>
              <span className="text-muted-foreground">100%</span>
            </div>
          )}
          <ProgressBar value={totalCards} max={99} />
        </div>
      )}

      {/* Card grid in collapsible accordion */}
      {cards.length > 0 && (
        <div className="rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setDecklistOpen(prev => !prev)}
            className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            <span>Decklist ({totalCards} cards)</span>
            <ChevronDown className={cn(
              "size-4 text-muted-foreground transition-transform duration-200",
              decklistOpen && "rotate-180"
            )} />
          </button>
          {decklistOpen && (
            <div className="px-4 pb-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {cards.map((card, i) => (
                  <CardHoverPreview key={`${i}-${card.name}`} cardName={card.name}>
                    <CardGridItem
                      name={card.name}
                      category={card.category}
                      reasoning={card.reasoning}
                    />
                  </CardHoverPreview>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty generating state */}
      {isGenerating && cards.length === 0 && !bracketReasoning && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
          <Loader2 className="size-8 animate-spin" />
          <p className="text-sm">Building your deck…</p>
        </div>
      )}

      {/* Partial generation warning */}
      {isPartial && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertCircle className="size-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-300 leading-snug">
            Generated {totalCards}/99 cards. Some cards may have been skipped.
          </p>
        </div>
      )}

      {/* Save warning (post-save, before redirect) */}
      {saveWarning && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertCircle className="size-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-300 leading-snug">{saveWarning}</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
          <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
          <div className="space-y-1 min-w-0">
            <p className="text-sm text-destructive leading-snug">{error}</p>
          </div>
        </div>
      )}

      {/* Save error */}
      {saveError && (
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
          <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive leading-snug">{saveError}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isGenerating || isSaving}
        >
          <ChevronLeft className="size-4 mr-1" />
          Back
        </Button>

        {isGenerating && (
          <Button
            type="button"
            variant="destructive"
            onClick={abort}
            className="gap-2"
          >
            <X className="size-4" />
            Cancel
          </Button>
        )}

        {error && (
          <Button type="button" onClick={handleRetry} className="gap-2">
            Retry
          </Button>
        )}

        {isComplete && (
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="gap-2 min-w-40"
          >
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating your deck…
              </>
            ) : (
              <>
                <Save className="size-4" />
                Save Deck
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
