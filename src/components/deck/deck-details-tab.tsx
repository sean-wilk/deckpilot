'use client'

import { startTransition, useState } from 'react'
import { db } from '@/lib/db'
import { decks } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ARCHETYPES } from '@/lib/constants/archetypes'
import { cn } from '@/lib/utils'

// ─── Server action ────────────────────────────────────────────────────────────

async function updateDeckDetails(
  deckId: string,
  updates: { philosophy?: string | null; archetype?: string | null }
) {
  'use server'
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  await db
    .update(decks)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(decks.id, deckId), eq(decks.ownerId, user.id)))

  revalidatePath(`/decks/${deckId}`)
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DeckDetailsTabProps {
  deckId: string
  philosophy: string | null
  archetype: string | null
  isOwner: boolean
}

type RecommendationMode = 'optimized' | 'discovery'

const RECOMMENDATION_MODES = {
  optimized: {
    label: 'Optimized',
    description: 'AI recommends the best meta cards — proven staples and high-synergy picks for competitive edge.',
  },
  discovery: {
    label: 'Discovery',
    description: 'AI recommends lesser-known, budget-friendly, and fun alternatives — perfect for brewers who want to stand out.',
  },
} as const

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

// ─── Wildcard / Discovery mode toggle ────────────────────────────────────────

function RecommendationModeToggle({
  deckId,
  disabled,
}: {
  deckId: string
  disabled: boolean
}) {
  const storageKey = `deck-recommendation-mode:${deckId}`
  const [mode, setMode] = useState<RecommendationMode>(() => {
    if (typeof window === 'undefined') return 'optimized'
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored === 'optimized' || stored === 'discovery') return stored
    } catch { /* localStorage unavailable */ }
    return 'optimized'
  })

  function handleModeChange(next: RecommendationMode) {
    if (disabled) return
    setMode(next)
    try {
      localStorage.setItem(storageKey, next)
    } catch {
      // ignore
    }
  }

  const activeMode = RECOMMENDATION_MODES[mode]

  return (
    <div>
      <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 gap-0.5">
        {(Object.keys(RECOMMENDATION_MODES) as RecommendationMode[]).map((key) => {
          const isActive = mode === key
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => handleModeChange(key)}
              aria-pressed={isActive}
              className={cn(
                'px-3.5 py-1.5 rounded-md text-sm font-medium transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                'disabled:cursor-not-allowed disabled:opacity-50',
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {RECOMMENDATION_MODES[key].label}
            </button>
          )
        })}
      </div>
      <SectionHint>{activeMode.description}</SectionHint>
    </div>
  )
}

// ─── DeckDetailsTab ───────────────────────────────────────────────────────────

export function DeckDetailsTab({ deckId, philosophy, archetype, isOwner }: DeckDetailsTabProps) {
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
      await updateDeckDetails(deckId, { philosophy: trimmed || null })
      setIsSaving(false)
    })
  }

  function handleArchetypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value
    setArchetypeValue(next)
    startTransition(async () => {
      await updateDeckDetails(deckId, { archetype: next || null })
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

      {/* ── Wildcard / Discovery mode ────────────────────────────────────────── */}
      <Section>
        <SectionLabel>Recommendation Mode</SectionLabel>
        <RecommendationModeToggle deckId={deckId} disabled={false} />
        {!isOwner && (
          <div className="mt-2">
            <SectionHint>
              Recommendation mode is stored locally and can be changed by any viewer.
            </SectionHint>
          </div>
        )}
      </Section>
    </div>
  )
}
