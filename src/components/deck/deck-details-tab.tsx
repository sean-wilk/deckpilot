'use client'

import { startTransition, useState } from 'react'
import { updateDeckPhilosophy, updateDeckArchetype } from '@/app/(dashboard)/decks/actions'
import { ARCHETYPES } from '@/lib/constants/archetypes'
import { cn } from '@/lib/utils'
import { SpicinessSlider } from '@/components/deck/spiciness-slider'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DeckDetailsTabProps {
  deckId: string
  philosophy: string | null
  archetype: string | null
  spiciness: number
  isOwner: boolean
}

const MAX_PHILOSOPHY_LENGTH = 1000

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('py-5 first:pt-0 last:pb-0', className)}>
      {children}
    </div>
  )
}

function SectionLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-sm font-medium text-foreground mb-1.5"
    >
      {children}
    </label>
  )
}

function SectionHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-xs text-muted-foreground">{children}</p>
}

// ─── DeckDetailsTab ───────────────────────────────────────────────────────────

export function DeckDetailsTab({ deckId, philosophy, archetype, spiciness, isOwner }: DeckDetailsTabProps) {
  const [philosophyValue, setPhilosophyValue] = useState(philosophy ?? '')
  const [archetypeValue, setArchetypeValue] = useState(archetype ?? '')
  const [isSaving, setIsSaving] = useState(false)

  const selectedArchetype = ARCHETYPES.find((a) => a.value === archetypeValue)

  function handlePhilosophyBlur() {
    const trimmed = philosophyValue.trim()
    // Only save if value changed
    if (trimmed === (philosophy ?? '').trim()) return
    setIsSaving(true)
    startTransition(async () => {
      await updateDeckPhilosophy(deckId, trimmed || null)
      setIsSaving(false)
    })
  }

  function handleArchetypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value
    setArchetypeValue(next)
    startTransition(async () => {
      await updateDeckArchetype(deckId, next || null)
    })
  }

  const charCount = philosophyValue.length
  const charCountColor =
    charCount > MAX_PHILOSOPHY_LENGTH * 0.9
      ? 'text-destructive'
      : charCount > MAX_PHILOSOPHY_LENGTH * 0.75
        ? 'text-amber-500'
        : 'text-muted-foreground'

  return (
    <div className="divide-y divide-border">
      {/* ── Philosophy ──────────────────────────────────────────────────────── */}
      <Section>
        <div className="flex items-center justify-between mb-1.5">
          <SectionLabel htmlFor="deck-philosophy">Deck Philosophy / Building Notes</SectionLabel>
          <span className={cn('text-xs tabular-nums transition-colors', charCountColor)}>
            {charCount}/{MAX_PHILOSOPHY_LENGTH}
          </span>
        </div>
        <textarea
          id="deck-philosophy"
          value={philosophyValue}
          onChange={(e) => {
            if (e.target.value.length <= MAX_PHILOSOPHY_LENGTH) {
              setPhilosophyValue(e.target.value)
            }
          }}
          onBlur={handlePhilosophyBlur}
          placeholder="Describe your deck's goals, constraints, or creative vision..."
          rows={5}
          disabled={!isOwner}
          aria-label="Deck philosophy and building notes"
          className={cn(
            'w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm',
            'transition-colors outline-none resize-none',
            'placeholder:text-muted-foreground',
            'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
            'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
            'dark:bg-input/30'
          )}
        />
        {isSaving && (
          <SectionHint>Saving…</SectionHint>
        )}
        {!isOwner && (
          <SectionHint>View only — you are not the deck owner.</SectionHint>
        )}
      </Section>

      {/* ── Archetype ───────────────────────────────────────────────────────── */}
      <Section>
        <SectionLabel htmlFor="deck-archetype">Deck Archetype</SectionLabel>
        <select
          id="deck-archetype"
          value={archetypeValue}
          onChange={handleArchetypeChange}
          disabled={!isOwner}
          aria-label="Deck archetype"
          className={cn(
            'h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm',
            'transition-colors outline-none',
            'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
            'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
            'dark:bg-input/30'
          )}
        >
          <option value="">— Select an archetype —</option>
          {ARCHETYPES.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        {selectedArchetype ? (
          <SectionHint>{selectedArchetype.description}</SectionHint>
        ) : (
          <SectionHint>Choose the primary strategy that defines your deck.</SectionHint>
        )}
      </Section>

      {/* ── Spiciness ────────────────────────────────────────────────────────── */}
      <Section>
        <SectionLabel>Spiciness</SectionLabel>
        <SpicinessSlider deckId={deckId} initialValue={spiciness} disabled={!isOwner} />
      </Section>
    </div>
  )
}
