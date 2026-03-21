'use client'

import { useState } from 'react'
import { Wand2, Swords, RefreshCw, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CommanderSearch } from '@/components/deck/commander-search'
import { ManaSymbolRow } from '@/components/ui/mana-symbol'
import { useCommanderSuggestions } from '@/hooks/use-commander-suggestions'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WizardState {
  commander: { id: string; name: string; colorIdentity: string[] } | null
  theme: string
  name: string
  description: string
  bracket: number | null
  budget: string
  spiciness: number
}

export interface StepCommanderProps {
  state: WizardState
  onNext: (updates: Partial<WizardState>) => void
}

type Mode = 'commander' | 'theme'

// ─── Score badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 8
      ? 'bg-green-500/15 text-green-400 border-green-500/30'
      : score >= 5
      ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
      : 'bg-orange-500/15 text-orange-400 border-orange-500/30'

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-bold tabular-nums leading-none shrink-0',
        color
      )}
    >
      {score}/10
    </span>
  )
}

// ─── Mode toggle ──────────────────────────────────────────────────────────────

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="flex rounded-xl border border-border bg-muted/40 p-1 gap-1">
      <button
        type="button"
        onClick={() => onChange('commander')}
        className={cn(
          'flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-150',
          mode === 'commander'
            ? 'bg-card text-foreground shadow-sm border border-border'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Swords className="size-4 shrink-0" />
        Start from a Commander
      </button>
      <button
        type="button"
        onClick={() => onChange('theme')}
        className={cn(
          'flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-150',
          mode === 'theme'
            ? 'bg-card text-foreground shadow-sm border border-border'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Wand2 className="size-4 shrink-0" />
        Start from a Theme
      </button>
    </div>
  )
}

// ─── Suggestion card ──────────────────────────────────────────────────────────

interface SuggestionCardProps {
  suggestion: {
    name: string
    color_identity: string[]
    match_score: number
    synergy_description: string
    why_this_commander: string
  }
  isSelected: boolean
  isResolving: boolean
  onSelect: () => void
}

function SuggestionCard({ suggestion, isSelected, isResolving, onSelect }: SuggestionCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isResolving}
      className={cn(
        'w-full text-left rounded-2xl border bg-card p-5 shadow-sm transition-all duration-150',
        'hover:border-primary/50 hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-60',
        isSelected
          ? 'border-primary ring-2 ring-primary'
          : 'border-border'
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {isSelected && isResolving ? (
            <Loader2 className="size-4 animate-spin text-primary shrink-0" />
          ) : null}
          <span className="font-semibold text-base leading-tight truncate">{suggestion.name}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ScoreBadge score={suggestion.match_score} />
          {suggestion.color_identity.length > 0 ? (
            <ManaSymbolRow colors={suggestion.color_identity} size="sm" />
          ) : (
            <span className="text-xs text-muted-foreground">Colorless</span>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed mb-1.5">
        {suggestion.synergy_description}
      </p>
      <p className="text-xs text-muted-foreground/70 italic leading-relaxed">
        {suggestion.why_this_commander}
      </p>
    </button>
  )
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function SuggestionSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 animate-pulse space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="h-4 w-40 rounded bg-muted" />
        <div className="flex gap-2">
          <div className="h-4 w-10 rounded-full bg-muted" />
          <div className="h-4 w-16 rounded bg-muted" />
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-4/5 rounded bg-muted" />
      </div>
      <div className="h-3 w-3/5 rounded bg-muted" />
    </div>
  )
}

// ─── Regeneration controls ────────────────────────────────────────────────────

const PRESETS = [
  { label: 'More Budget', value: 'more_budget' },
  { label: 'More Competitive', value: 'more_competitive' },
  { label: 'More Casual', value: 'more_casual' },
] as const

interface RegenerationControlsProps {
  isLoading: boolean
  onPreset: (preset: string) => void
  onTweakRegenerate: (tweak: string) => void
  onRegenerate: () => void
}

function RegenerationControls({
  isLoading,
  onPreset,
  onTweakRegenerate,
  onRegenerate,
}: RegenerationControlsProps) {
  const [tweak, setTweak] = useState('')

  function handleTweakSubmit() {
    if (!tweak.trim()) return
    onTweakRegenerate(tweak.trim())
    setTweak('')
  }

  return (
    <div className="space-y-3 pt-1">
      {/* Preset buttons */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p.value}
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoading}
            onClick={() => onPreset(p.value)}
            className="text-xs"
          >
            {p.label}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isLoading}
          onClick={onRegenerate}
          className="text-xs gap-1.5"
        >
          <RefreshCw className="size-3" />
          Regenerate
        </Button>
      </div>

      {/* Custom tweak */}
      <div className="flex gap-2">
        <Input
          value={tweak}
          onChange={(e) => setTweak(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleTweakSubmit()}
          placeholder="e.g. prefer green commanders, budget-friendly…"
          disabled={isLoading}
          className="text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isLoading || !tweak.trim()}
          onClick={handleTweakSubmit}
          className="shrink-0"
        >
          Apply
        </Button>
      </div>
    </div>
  )
}

// ─── StepCommander ────────────────────────────────────────────────────────────

export function StepCommander({ state, onNext }: StepCommanderProps) {
  const [mode, setMode] = useState<Mode>(state.commander ? 'commander' : 'commander')
  const [commanderCard, setCommanderCard] = useState<{
    id: string
    name: string
    colorIdentity: string[]
  } | null>(state.commander)
  const [theme, setTheme] = useState(state.theme ?? '')
  const [selectedSuggestionName, setSelectedSuggestionName] = useState<string | null>(null)
  const [isResolvingId, setIsResolvingId] = useState(false)
  const [resolveError, setResolveError] = useState<string | null>(null)

  const { suggestions, isLoading, error: suggestError, suggest, regenerate } = useCommanderSuggestions()

  const hasSuggestions = suggestions.length > 0
  const commanderReady = mode === 'commander' ? commanderCard !== null : selectedSuggestionName !== null
  const themeReady = theme.trim().length > 0

  // ─── Commander-first: Next ─────────────────────────────────────────────────

  function handleCommanderNext() {
    if (!commanderCard) return
    onNext({ commander: commanderCard, theme: '' })
  }

  // ─── Theme-first: Fetch suggestions ───────────────────────────────────────

  async function handleFindCommanders() {
    if (!theme.trim()) return
    setSelectedSuggestionName(null)
    setResolveError(null)
    await suggest(theme)
  }

  // ─── Theme-first: Select suggestion ───────────────────────────────────────

  async function handleSelectSuggestion(name: string, colorIdentity: string[]) {
    setSelectedSuggestionName(name)
    setResolveError(null)
    setIsResolvingId(true)

    try {
      const res = await fetch(`/api/cards/search?q=${encodeURIComponent(name)}&exact=true&limit=1`)
      if (!res.ok) throw new Error(`Search failed (${res.status})`)
      const { cards } = await res.json()

      if (cards?.[0]) {
        onNext({
          commander: {
            id: cards[0].id,
            name: cards[0].name,
            colorIdentity: cards[0].color_identity,
          },
          theme,
        })
      } else {
        // Fallback: try without exact flag using color identity from suggestion
        const res2 = await fetch(`/api/cards/search?q=${encodeURIComponent(name)}&limit=5`)
        const data2 = await res2.json()
        const match = data2.cards?.find(
          (c: { name: string }) => c.name.toLowerCase() === name.toLowerCase()
        ) ?? data2.cards?.[0]

        if (match) {
          onNext({
            commander: {
              id: match.id,
              name: match.name,
              colorIdentity: match.color_identity ?? colorIdentity,
            },
            theme,
          })
        } else {
          setResolveError(`Commander "${name}" not found in the card database.`)
          setSelectedSuggestionName(null)
        }
      }
    } catch (err) {
      setResolveError(err instanceof Error ? err.message : 'Failed to look up commander.')
      setSelectedSuggestionName(null)
    } finally {
      setIsResolvingId(false)
    }
  }

  // ─── Rendering ────────────────────────────────────────────────────────────

  const displayError = resolveError ?? suggestError

  return (
    <div className="space-y-6">
      {/* Mode toggle */}
      <ModeToggle mode={mode} onChange={(m) => {
        setMode(m)
        setSelectedSuggestionName(null)
        setResolveError(null)
      }} />

      {/* Commander-first path */}
      {mode === 'commander' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-1 duration-200">
          <CommanderSearch
            name="commanderId"
            label="Commander"
            placeholder="Search by name…"
            required
            defaultValue={
              state.commander
                ? { id: state.commander.id, name: state.commander.name, typeLine: '', colorIdentity: state.commander.colorIdentity }
                : null
            }
            onChange={(card) =>
              setCommanderCard(
                card ? { id: card.id, name: card.name, colorIdentity: card.colorIdentity } : null
              )
            }
          />

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              onClick={handleCommanderNext}
              disabled={!commanderReady}
              className="min-w-28"
            >
              Next
            </Button>
            {!commanderReady && (
              <p className="text-xs text-muted-foreground">Select a commander to continue.</p>
            )}
          </div>
        </div>
      )}

      {/* Theme-first path */}
      {mode === 'theme' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Theme input */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Deck Theme or Strategy <span className="text-destructive">*</span>
            </label>
            <textarea
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="Describe your deck theme, strategy, or archetype…"
              rows={3}
              className={cn(
                'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring',
                'resize-none transition-shadow'
              )}
            />
            <p className="text-xs text-muted-foreground">
              e.g. aristocrats, voltron, group hug, tokens, draw-go control, zombie tribal…
            </p>
          </div>

          {/* Find commanders button */}
          <Button
            type="button"
            onClick={handleFindCommanders}
            disabled={isLoading || !themeReady}
            className="gap-2"
          >
            {isLoading && !hasSuggestions ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Finding Commanders…
              </>
            ) : (
              <>
                <Wand2 className="size-4" />
                Find Commanders
              </>
            )}
          </Button>

          {/* Error state */}
          {displayError && (
            <div className="flex items-start gap-2.5 rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3">
              <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-1 min-w-0">
                <p className="text-sm text-destructive leading-snug">{displayError}</p>
                <button
                  type="button"
                  onClick={handleFindCommanders}
                  className="text-xs text-destructive/70 hover:text-destructive underline-offset-2 hover:underline transition-colors"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* Loading skeletons */}
          {isLoading && !hasSuggestions && (
            <div className="space-y-3">
              <SuggestionSkeleton />
              <SuggestionSkeleton />
              <SuggestionSkeleton />
            </div>
          )}

          {/* Suggestions */}
          {hasSuggestions && (
            <div className="space-y-4">
              <div className="space-y-3">
                {isLoading ? (
                  <>
                    <SuggestionSkeleton />
                    <SuggestionSkeleton />
                    <SuggestionSkeleton />
                  </>
                ) : (
                  suggestions.map((s) => (
                    <SuggestionCard
                      key={s.name}
                      suggestion={s}
                      isSelected={selectedSuggestionName === s.name}
                      isResolving={isResolvingId}
                      onSelect={() => handleSelectSuggestion(s.name, s.color_identity)}
                    />
                  ))
                )}
              </div>

              {/* Regeneration controls */}
              {!isLoading && (
                <RegenerationControls
                  isLoading={isLoading || isResolvingId}
                  onPreset={(preset) => regenerate({ preset })}
                  onTweakRegenerate={(tweak) => regenerate({ tweak })}
                  onRegenerate={() => regenerate()}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
