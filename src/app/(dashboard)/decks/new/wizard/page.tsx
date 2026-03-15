'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Wand2, Swords, DollarSign, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CommanderSearch } from '@/components/deck/commander-search'
import { cn } from '@/lib/utils'
import { createDeck, addCardToDeck } from '@/app/(dashboard)/decks/actions'

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = 'commander' | 'theme'

type WizardPhase =
  | 'form'
  | 'suggesting'
  | 'pick-commander'
  | 'generating'
  | 'saving'
  | 'done'

interface SearchCard {
  id: string
  name: string
  typeLine: string
  colorIdentity: string[]
}

interface CommanderSuggestion {
  name: string
  color_identity: string[]
  play_style: string
  synergy_notes: string
  why_this_commander: string
}

interface GeneratedCard {
  name: string
  category: string
  reasoning: string
}

// ─── Bracket data ─────────────────────────────────────────────────────────────

const BRACKETS = [
  { value: 1, label: 'B1', sublabel: 'Casual', description: 'Precon-power or below' },
  { value: 2, label: 'B2', sublabel: 'Focused', description: 'Upgraded, no combos' },
  { value: 3, label: 'B3', sublabel: 'Optimized', description: 'Powerful synergies' },
  { value: 4, label: 'B4', sublabel: 'cEDH', description: 'Competitive play' },
]

const BRACKET_ACCENT: Record<number, string> = {
  1: 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  2: 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-400',
  3: 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  4: 'border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-400',
}

const BRACKET_UNSELECTED =
  'border-border bg-card text-muted-foreground hover:border-foreground/30 hover:bg-muted/40'

// ─── BracketSelector ─────────────────────────────────────────────────────────

function BracketSelector({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        Target Bracket <span className="text-destructive">*</span>
      </Label>
      <div className="grid grid-cols-4 gap-2">
        {BRACKETS.map((b) => (
          <button
            key={b.value}
            type="button"
            onClick={() => onChange(b.value)}
            className={cn(
              'flex flex-col items-center gap-0.5 rounded-xl border-2 px-2 py-3 transition-all duration-150 cursor-pointer select-none',
              value === b.value ? BRACKET_ACCENT[b.value] : BRACKET_UNSELECTED
            )}
          >
            <span className="text-sm font-bold leading-none">{b.label}</span>
            <span className="text-[11px] font-medium leading-none">{b.sublabel}</span>
            <span className="text-[10px] leading-snug text-center opacity-70 mt-0.5 hidden sm:block">
              {b.description}
            </span>
          </button>
        ))}
      </div>
    </div>
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

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepDot({ active, done }: { active: boolean; done: boolean }) {
  return (
    <div
      className={cn(
        'size-2 rounded-full transition-all duration-200',
        done
          ? 'bg-primary'
          : active
          ? 'bg-primary/60 scale-125'
          : 'bg-border'
      )}
    />
  )
}

// ─── Color identity badge ─────────────────────────────────────────────────────

const COLOR_LABELS: Record<string, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
}

function ColorBadges({ colors }: { colors: string[] }) {
  if (colors.length === 0) return <span className="text-xs text-muted-foreground">Colorless</span>
  return (
    <div className="flex gap-1 flex-wrap">
      {colors.map((c) => (
        <span
          key={c}
          className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold bg-muted text-muted-foreground"
        >
          {COLOR_LABELS[c] ?? c}
        </span>
      ))}
    </div>
  )
}

// ─── WizardPage ───────────────────────────────────────────────────────────────

export default function WizardPage() {
  const router = useRouter()

  // Form state
  const [mode, setMode] = useState<Mode>('commander')
  const [commander, setCommander] = useState<SearchCard | null>(null)
  const [strategy, setStrategy] = useState('')
  const [bracket, setBracket] = useState(2)
  const [budget, setBudget] = useState('')

  // Flow state
  const [phase, setPhase] = useState<WizardPhase>('form')
  const [error, setError] = useState<string | null>(null)

  // Theme-first: suggested commanders
  const [suggestions, setSuggestions] = useState<CommanderSuggestion[]>([])
  const [selectedSuggestion, setSelectedSuggestion] = useState<CommanderSuggestion | null>(null)

  // Generation state
  const [generatedCards, setGeneratedCards] = useState<GeneratedCard[]>([])
  const [strategySummary, setStrategySummary] = useState('')

  // Saving progress
  const [saveProgress, setSaveProgress] = useState<{ current: number; total: number } | null>(null)

  const isGenerating = phase === 'suggesting' || phase === 'generating' || phase === 'saving'

  // Step completion tracking
  const step1Done = mode === 'commander' ? commander !== null : strategy.trim().length > 0
  const step2Done = bracket >= 1 && bracket <= 4

  function handleModeChange(m: Mode) {
    setMode(m)
    setError(null)
  }

  // ─── Theme-first: fetch commander suggestions ────────────────────────────────

  async function suggestCommanders() {
    setError(null)
    setPhase('suggesting')

    try {
      const res = await fetch('/api/ai/suggest-commanders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: strategy, description: strategy }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`)
      }

      const data = await res.json() as { suggestions: CommanderSuggestion[] }
      setSuggestions(data.suggestions ?? [])
      setPhase('pick-commander')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to suggest commanders.')
      setPhase('form')
    }
  }

  // ─── Look up a card ID by exact name ────────────────────────────────────────

  async function lookupCardId(name: string): Promise<string | null> {
    try {
      const res = await fetch(`/api/cards/search?q=${encodeURIComponent(name)}&limit=5`)
      if (!res.ok) return null
      const data = await res.json() as { cards: Array<{ id: string; name: string }> }
      const exact = data.cards.find(
        (c) => c.name.toLowerCase() === name.toLowerCase()
      )
      return exact?.id ?? data.cards[0]?.id ?? null
    } catch {
      return null
    }
  }

  // ─── Generate deck (streaming) ───────────────────────────────────────────────

  async function generateDeck(commanderId: string) {
    setError(null)
    setPhase('generating')
    setGeneratedCards([])
    setStrategySummary('')

    const budgetCents = budget ? Math.round(Number(budget) * 100) : undefined

    try {
      const res = await fetch('/api/ai/generate-deck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commanderId,
          description: strategy || undefined,
          targetBracket: bracket,
          budgetLimitCents: budgetCents,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`)
      }

      // Parse streamed text response — the AI SDK streams partial JSON deltas.
      // We collect the full text then parse the final complete JSON object.
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        accumulated += chunk

        // Try to extract cards array from accumulated partial JSON for live preview.
        // The streamObject format sends incremental JSON — attempt best-effort parse.
        try {
          // Find the cards array in the partial JSON
          const cardsMatch = accumulated.match(/"cards"\s*:\s*(\[[\s\S]*?\])(?=[,}]|$)/)
          if (cardsMatch) {
            // Complete any dangling partial object by closing it
            let partial = cardsMatch[1]
            // Count open/close braces to check if last object is complete
            const openBraces = (partial.match(/\{/g) ?? []).length
            const closeBraces = (partial.match(/\}/g) ?? []).length
            if (openBraces > closeBraces) {
              // Last card object is incomplete — truncate to last complete }
              const lastClose = partial.lastIndexOf('}')
              if (lastClose !== -1) {
                partial = partial.slice(0, lastClose + 1) + ']'
              } else {
                partial = '[]'
              }
            }
            const parsed = JSON.parse(partial) as GeneratedCard[]
            if (Array.isArray(parsed) && parsed.length > 0) {
              setGeneratedCards(parsed)
            }
          }
        } catch {
          // Partial parse failed — keep accumulating
        }
      }

      // Final parse of complete response
      let finalCards: GeneratedCard[] = []
      let finalSummary = ''
      try {
        const parsed = JSON.parse(accumulated) as {
          cards?: GeneratedCard[]
          strategy_summary?: string
          estimated_bracket?: number
        }
        finalCards = parsed.cards ?? []
        finalSummary = parsed.strategy_summary ?? ''
      } catch {
        // Use whatever was accumulated from streaming
        finalCards = generatedCards
      }

      setGeneratedCards(finalCards)
      setStrategySummary(finalSummary)

      // Now save to DB
      await saveDeck(commanderId, finalCards)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate deck.')
      setPhase('form')
    }
  }

  // ─── Save deck to DB ─────────────────────────────────────────────────────────

  async function saveDeck(commanderId: string, deckCards: GeneratedCard[]) {
    setPhase('saving')
    setSaveProgress({ current: 0, total: deckCards.length })

    try {
      // Build FormData for createDeck
      const fd = new FormData()
      fd.append('name', `New Deck`)
      fd.append('commanderId', commanderId)
      fd.append('targetBracket', String(bracket))
      if (budget) fd.append('budgetLimitCents', String(Math.round(Number(budget) * 100)))

      const { id: deckId } = await createDeck(fd)

      // Add each card sequentially, looking up by name
      let added = 0
      for (const card of deckCards) {
        const cardId = await lookupCardId(card.name)
        if (cardId) {
          await addCardToDeck(deckId, cardId)
        }
        added++
        setSaveProgress({ current: added, total: deckCards.length })
      }

      setPhase('done')
      router.push(`/decks/${deckId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save deck.')
      setPhase('form')
      setSaveProgress(null)
    }
  }

  // ─── Main generate handler ───────────────────────────────────────────────────

  async function handleGenerate() {
    setError(null)

    if (mode === 'commander') {
      if (!commander) {
        setError('Please select a commander to continue.')
        return
      }
      await generateDeck(commander.id)
    } else {
      // theme mode
      if (!strategy.trim()) {
        setError('Please describe a theme or strategy to continue.')
        return
      }
      if (commander) {
        // Commander already chosen in theme mode — skip suggestion step
        await generateDeck(commander.id)
      } else {
        await suggestCommanders()
      }
    }
  }

  // ─── After picking a suggested commander ────────────────────────────────────

  async function handlePickSuggestion(suggestion: CommanderSuggestion) {
    setSelectedSuggestion(suggestion)
    // Need the DB ID for this commander
    const cardId = await lookupCardId(suggestion.name)
    if (!cardId) {
      setError(`Commander "${suggestion.name}" not found in the card database.`)
      setPhase('pick-commander')
      return
    }
    await generateDeck(cardId)
  }

  // ─── Rendering ───────────────────────────────────────────────────────────────

  // Phase: pick commander from suggestions
  if (phase === 'pick-commander') {
    return (
      <div className="max-w-xl mx-auto">
        <button
          type="button"
          onClick={() => { setPhase('form'); setError(null) }}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ChevronLeft className="size-4" />
          Back
        </button>

        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Choose a Commander</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Based on your theme, we suggest these commanders.
          </p>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-2.5 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="space-y-3">
          {suggestions.map((s) => (
            <button
              key={s.name}
              type="button"
              onClick={() => handlePickSuggestion(s)}
              className={cn(
                'w-full text-left rounded-2xl border border-border bg-card p-5 shadow-sm',
                'hover:border-primary/50 hover:bg-muted/30 transition-all duration-150',
                selectedSuggestion?.name === s.name && 'border-primary ring-1 ring-primary'
              )}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <span className="font-semibold text-base">{s.name}</span>
                <ColorBadges colors={s.color_identity} />
              </div>
              <p className="text-sm text-muted-foreground mb-1">
                <span className="font-medium text-foreground">Play style:</span> {s.play_style}
              </p>
              <p className="text-sm text-muted-foreground">
                {s.why_this_commander}
              </p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Phase: generating / saving
  if (phase === 'generating' || phase === 'saving') {
    return (
      <div className="max-w-xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">
            {phase === 'generating' ? 'Generating Deck…' : 'Saving Deck…'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {phase === 'generating'
              ? 'Hang tight while the AI builds your deck.'
              : saveProgress
              ? `Adding card ${saveProgress.current} of ${saveProgress.total}…`
              : 'Saving your deck…'}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <Loader2 className="size-5 animate-spin text-primary shrink-0" />
            <span className="text-sm font-medium">
              {phase === 'generating'
                ? `${generatedCards.length} card${generatedCards.length !== 1 ? 's' : ''} generated so far…`
                : saveProgress
                ? `${saveProgress.current} / ${saveProgress.total} cards added`
                : 'Creating deck…'}
            </span>
          </div>

          {phase === 'saving' && saveProgress && (
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${(saveProgress.current / saveProgress.total) * 100}%` }}
              />
            </div>
          )}

          {generatedCards.length > 0 && (
            <div className="max-h-64 overflow-y-auto space-y-1">
              {generatedCards.map((card, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <Check className="size-3.5 text-emerald-500 shrink-0" />
                  <span className="font-medium">{card.name}</span>
                  <span className="text-muted-foreground text-xs">{card.category}</span>
                </div>
              ))}
            </div>
          )}

          {strategySummary && (
            <p className="text-sm text-muted-foreground border-t border-border pt-3">
              {strategySummary}
            </p>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-2.5 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    )
  }

  // Phase: form (default)
  return (
    <div className="max-w-xl mx-auto">
      {/* Back nav */}
      <Link
        href="/decks/new"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft className="size-4" />
        New Deck
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Deck Wizard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Tell us what kind of deck you want and we&apos;ll build it for you.
        </p>
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-2 mb-6">
        <StepDot active={!step1Done} done={step1Done} />
        <div className={cn('h-px flex-1 transition-colors duration-300', step1Done ? 'bg-primary/40' : 'bg-border')} />
        <StepDot active={step1Done && !step2Done} done={step2Done} />
        <div className={cn('h-px flex-1 transition-colors duration-300', step2Done ? 'bg-primary/40' : 'bg-border')} />
        <StepDot active={step1Done && step2Done} done={false} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
        {/* Mode toggle */}
        <ModeToggle mode={mode} onChange={handleModeChange} />

        {/* Commander path */}
        {mode === 'commander' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-top-1 duration-200">
            <CommanderSearch
              name="commanderId"
              label="Commander"
              placeholder="Search by name…"
              required
              onChange={(card) => setCommander(card)}
            />

            <div className="space-y-1.5">
              <Label htmlFor="strategy-commander">
                Strategy Description{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <textarea
                id="strategy-commander"
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                placeholder="e.g. voltron, ramp into big creatures, stax…"
                rows={3}
                className={cn(
                  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                  'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring',
                  'resize-none transition-shadow'
                )}
              />
              <p className="text-xs text-muted-foreground">
                Optionally guide the deck toward a specific playstyle.
              </p>
            </div>
          </div>
        )}

        {/* Theme path */}
        {mode === 'theme' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="space-y-1.5">
              <Label htmlFor="strategy-theme">
                Theme or Strategy <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="strategy-theme"
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                placeholder="e.g. aristocrats, group hug, voltron, tokens, draw-go control…"
                rows={3}
                className={cn(
                  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                  'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring',
                  'resize-none transition-shadow'
                )}
                required
              />
              <p className="text-xs text-muted-foreground">
                Describe the archetype or playstyle. We&apos;ll suggest a commander that fits.
              </p>
            </div>

            <CommanderSearch
              name="commanderId"
              label="Commander (optional — we'll suggest one if left blank)"
              placeholder="Or pick your own commander…"
              onChange={(card) => setCommander(card)}
            />
          </div>
        )}

        {/* Bracket selector */}
        <BracketSelector value={bracket} onChange={setBracket} />

        {/* Budget */}
        <div className="space-y-1.5">
          <Label htmlFor="budgetInput">
            Budget Limit{' '}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              id="budgetInput"
              name="budgetLimitCents"
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

        {/* Error */}
        {error && (
          <p className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-2.5 text-sm text-destructive">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="min-w-36"
          >
            {isGenerating ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                {phase === 'suggesting' ? 'Finding Commanders…' : 'Generating…'}
              </>
            ) : (
              <>
                <Wand2 className="size-4 mr-2" />
                Generate Deck
              </>
            )}
          </Button>
          <Link
            href="/decks/new"
            className={isGenerating ? 'pointer-events-none opacity-50' : 'text-sm text-muted-foreground hover:text-foreground transition-colors'}
          >
            Cancel
          </Link>
        </div>
      </div>
    </div>
  )
}
