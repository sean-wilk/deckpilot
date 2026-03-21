'use client'

import { useState } from 'react'
import { Wand2, DollarSign, ChevronLeft, Zap, Shield, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ManaSymbolRow } from '@/components/ui/mana-symbol'
import { BRACKETS, BRACKET_ACCENT_COLORS } from '@/lib/constants/brackets'
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
  generationMode: 'fast' | 'standard' | 'precision'
}

interface StepDetailsProps {
  state: WizardState
  onNext: (updates: Partial<WizardState>) => void
  onBack: () => void
}

// ─── Generation Modes ─────────────────────────────────────────────────────────

const GENERATION_MODES = [
  {
    value: 'fast' as const,
    label: 'Fast',
    description: 'Stream cards in real-time with instant validation. Some cards may need manual review.',
    time: '~60-90s',
    icon: Zap,
  },
  {
    value: 'standard' as const,
    label: 'Standard',
    description: 'AI generates, validates, and fixes invalid cards automatically. Better results, slightly longer.',
    time: '~90-120s',
    icon: Shield,
  },
  {
    value: 'precision' as const,
    label: 'Precision',
    description: 'Category-by-category generation with per-batch validation. Most reliable results.',
    time: '~3-5 min',
    icon: Target,
  },
]

// ─── BracketSelector ─────────────────────────────────────────────────────────

const BRACKET_UNSELECTED =
  'border-border bg-card text-muted-foreground hover:border-foreground/30 hover:bg-muted/40'

function BracketSelector({
  value,
  onChange,
}: {
  value: number | null
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        Target Bracket <span className="text-destructive">*</span>
      </Label>
      <div className="grid grid-cols-5 gap-2">
        {BRACKETS.map((b) => (
          <button
            key={b.value}
            type="button"
            onClick={() => onChange(b.value)}
            className={cn(
              'flex flex-col items-center gap-0.5 rounded-xl border-2 px-2 py-3 transition-all duration-150 cursor-pointer select-none',
              value === b.value ? BRACKET_ACCENT_COLORS[b.value] : BRACKET_UNSELECTED
            )}
          >
            <span className="text-sm font-bold leading-none">{b.label}</span>
            <span className="text-xs font-medium leading-none opacity-70">{b.sublabel}</span>
            <span className="text-[10px] leading-snug text-center opacity-70 mt-0.5 hidden sm:block">
              {b.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── CommanderBar ─────────────────────────────────────────────────────────────

function CommanderBar({ commander }: { commander: NonNullable<WizardState['commander']> }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
          Commander
        </p>
        <p className="text-sm font-semibold truncate">{commander.name}</p>
      </div>
      {commander.colorIdentity && commander.colorIdentity.length > 0 ? (
        <ManaSymbolRow colors={commander.colorIdentity} size="sm" />
      ) : (
        <span className="text-xs text-muted-foreground">Colorless</span>
      )}
    </div>
  )
}

// ─── Spiciness ────────────────────────────────────────────────────────────────

const SPICINESS_TIERS = [
  { min: 0, max: 15, label: 'Meta Optimal', color: 'text-blue-400' },
  { min: 16, max: 35, label: 'Tuned', color: 'text-green-400' },
  { min: 36, max: 65, label: 'Balanced', color: 'text-yellow-400' },
  { min: 66, max: 85, label: 'Spicy', color: 'text-orange-400' },
  { min: 86, max: 100, label: 'Jank Paradise', color: 'text-red-400' },
]

function getCurrentTier(value: number) {
  return SPICINESS_TIERS.find(t => value >= t.min && value <= t.max) ?? SPICINESS_TIERS[2]
}

// ─── StepDetails ─────────────────────────────────────────────────────────────

export function StepDetails({ state, onNext, onBack }: StepDetailsProps) {
  const [name, setName] = useState(
    state.name || (state.commander ? `${state.commander.name} Deck` : '')
  )
  const [description, setDescription] = useState(state.description || state.theme || '')
  const [bracket, setBracket] = useState<number | null>(state.bracket)
  const [budget, setBudget] = useState(state.budget || '')
  const [spiciness, setSpiciness] = useState(state.spiciness ?? 30)
  const [generationMode, setGenerationMode] = useState<'fast' | 'standard' | 'precision'>(state.generationMode ?? 'fast')

  const currentTier = getCurrentTier(spiciness)
  const canGenerate = name.trim().length > 0 && bracket !== null

  function handleGenerate() {
    if (!canGenerate) return
    onNext({ name: name.trim(), description, bracket, budget, spiciness, generationMode })
  }

  return (
    <div className="space-y-6">
      {/* Commander confirmation bar */}
      {state.commander && <CommanderBar commander={state.commander} />}

      {/* Deck Name */}
      <div className="space-y-1.5">
        <Label htmlFor="deck-name">
          Deck Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="deck-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Atraxa Superfriends"
          required
          maxLength={120}
          autoComplete="off"
        />
      </div>

      {/* Strategy Description */}
      <div className="space-y-1.5">
        <Label htmlFor="deck-description">
          Strategy Description{' '}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <textarea
          id="deck-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your deck strategy, win conditions, or play style..."
          rows={3}
          className={cn(
            'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
            'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring',
            'resize-none transition-shadow'
          )}
        />
      </div>

      {/* Bracket selector */}
      <BracketSelector value={bracket} onChange={setBracket} />

      {/* Spiciness / Creativity */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Creativity Level</Label>
          <span className={cn("text-sm font-medium", currentTier.color)}>
            {currentTier.label} ({spiciness})
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={spiciness}
          onChange={(e) => setSpiciness(Number(e.target.value))}
          className="w-full accent-primary"
        />
        <p className="text-xs text-muted-foreground">
          Lower values favor proven staples, higher values embrace creative and unexpected choices.
        </p>
      </div>

      {/* Generation Mode */}
      <div className="space-y-2">
        <Label>Generation Mode</Label>
        <div className="grid grid-cols-1 gap-2">
          {GENERATION_MODES.map((mode) => {
            const Icon = mode.icon
            const isSelected = generationMode === mode.value
            return (
              <button
                key={mode.value}
                type="button"
                onClick={() => setGenerationMode(mode.value)}
                className={cn(
                  'flex items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all duration-150',
                  isSelected
                    ? 'border-primary ring-2 ring-primary bg-primary/5'
                    : 'border-border hover:border-foreground/20'
                )}
              >
                <Icon className={cn('size-5 shrink-0 mt-0.5', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold leading-none">{mode.label}</span>
                    <span className="text-xs text-muted-foreground">{mode.time}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{mode.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Budget */}
      <div className="space-y-1.5">
        <Label htmlFor="budget-input">
          Budget Limit{' '}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            id="budget-input"
            type="number"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="e.g. 500"
            min={0}
            step={1}
            className="pl-9"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Enter the total budget in dollars. Leave blank for no limit.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          <ChevronLeft className="size-4 mr-1" />
          Back
        </Button>
        <Button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="min-w-36"
        >
          <Wand2 className="size-4 mr-2" />
          Generate Deck
        </Button>
      </div>
    </div>
  )
}
