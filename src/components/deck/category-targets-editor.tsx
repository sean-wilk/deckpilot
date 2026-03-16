'use client'

import { startTransition, useCallback, useRef, useState } from 'react'
import { updateCategoryTargets } from '@/app/(dashboard)/decks/actions'
import { SENSIBLE_DEFAULTS, CATEGORY_LABELS, CATEGORY_KEYS } from '@/lib/constants/category-defaults'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CategoryTargetsEditorProps {
  deckId: string
  currentTargets: Record<string, number> | null
  suggestedTargets?: Array<{ category: string; target_count: number; reasoning: string }> | null
  isOwner: boolean
}

// The six editable categories (excludes lands which is managed separately)
const EDITABLE_KEYS = CATEGORY_KEYS.filter((k) => k !== 'lands')

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSuggestedValue(
  category: string,
  suggestedTargets: Array<{ category: string; target_count: number; reasoning: string }> | null | undefined
): number | undefined {
  return suggestedTargets?.find((s) => s.category === category)?.target_count
}

function getSuggestedReasoning(
  category: string,
  suggestedTargets: Array<{ category: string; target_count: number; reasoning: string }> | null | undefined
): string | undefined {
  return suggestedTargets?.find((s) => s.category === category)?.reasoning
}

type InputBadge = 'ai-suggested' | 'custom' | null

// ─── CategoryTargetsEditor ────────────────────────────────────────────────────

export function CategoryTargetsEditor({
  deckId,
  currentTargets,
  suggestedTargets,
  isOwner,
}: CategoryTargetsEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Local state: string values per category for controlled inputs
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const key of EDITABLE_KEYS) {
      const saved = currentTargets?.[key]
      init[key] = saved !== undefined ? String(saved) : ''
    }
    return init
  })

  // Track which fields have been edited since last save
  const dirtyRef = useRef<Set<string>>(new Set())
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Persist ──────────────────────────────────────────────────────────────

  const persistTargets = useCallback(
    (updatedValues: Record<string, string>) => {
      const merged: Record<string, number> = {}
      for (const key of EDITABLE_KEYS) {
        const raw = updatedValues[key]
        const num = raw !== '' ? Number(raw) : SENSIBLE_DEFAULTS[key]
        merged[key] = Number.isFinite(num) ? Math.max(0, Math.round(num)) : SENSIBLE_DEFAULTS[key]
      }
      // Preserve lands target if it exists on currentTargets
      if (currentTargets?.lands !== undefined) {
        merged.lands = currentTargets.lands
      }
      setIsSaving(true)
      startTransition(async () => {
        await updateCategoryTargets(deckId, merged)
        setIsSaving(false)
      })
    },
    [deckId, currentTargets]
  )

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleChange(category: string, raw: string) {
    if (!isOwner) return
    // Allow only non-negative integers
    if (raw !== '' && !/^\d+$/.test(raw)) return
    const next = { ...values, [category]: raw }
    setValues(next)
    dirtyRef.current.add(category)

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      persistTargets(next)
      dirtyRef.current.clear()
    }, 800)
  }

  function handleBlur(category: string) {
    if (!isOwner) return
    if (!dirtyRef.current.has(category)) return
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    persistTargets(values)
    dirtyRef.current.clear()
  }

  function handleResetToDefaults() {
    if (!isOwner) return
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    const cleared: Record<string, string> = {}
    for (const key of EDITABLE_KEYS) cleared[key] = ''
    setValues(cleared)
    dirtyRef.current.clear()
    setIsSaving(true)
    startTransition(async () => {
      await updateCategoryTargets(deckId, null)
      setIsSaving(false)
    })
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const hasSuggestions = suggestedTargets && suggestedTargets.length > 0

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* ── Header / toggle ──────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        aria-expanded={isExpanded}
        className={cn(
          'flex w-full items-center justify-between px-4 py-3 text-left',
          'transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          isExpanded ? 'rounded-t-lg' : 'rounded-lg'
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Category Targets</span>
          {isSaving && (
            <span className="text-xs text-muted-foreground">Saving…</span>
          )}
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={cn('shrink-0 text-muted-foreground transition-transform duration-200', isExpanded && 'rotate-180')}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      {isExpanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
          {/* AI suggestion note */}
          {hasSuggestions && (
            <p className="text-xs text-muted-foreground rounded-md bg-muted/50 px-3 py-2 leading-relaxed">
              These targets were suggested by AI based on your deck&rsquo;s strategy
            </p>
          )}

          {/* Input grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            {EDITABLE_KEYS.map((key) => {
              const label = CATEGORY_LABELS[key] ?? key
              const defaultVal = SENSIBLE_DEFAULTS[key]
              const suggested = getSuggestedValue(key, suggestedTargets)
              const reasoning = getSuggestedReasoning(key, suggestedTargets)
              const inputId = `category-target-${key}`

              // Determine badge for this field
              const currentNumVal = values[key] !== '' ? Number(values[key]) : null
              let badge: InputBadge = null
              if (currentNumVal !== null) {
                if (suggested !== undefined && currentNumVal === suggested) {
                  badge = 'ai-suggested'
                } else if (currentTargets !== null && currentNumVal !== defaultVal) {
                  badge = 'custom'
                } else if (currentTargets !== null && currentNumVal === defaultVal && suggested !== undefined) {
                  // saved the default explicitly but AI suggested something different
                  badge = null
                }
              }

              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <label
                      htmlFor={inputId}
                      className="text-xs font-medium text-foreground"
                    >
                      {label}
                    </label>
                    {badge === 'ai-suggested' && (
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 leading-none">
                        AI-suggested
                      </span>
                    )}
                    {badge === 'custom' && (
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 leading-none">
                        Custom
                      </span>
                    )}
                  </div>
                  <input
                    id={inputId}
                    type="number"
                    min="0"
                    step="1"
                    value={values[key]}
                    placeholder={String(suggested ?? defaultVal)}
                    onChange={(e) => handleChange(key, e.target.value)}
                    onBlur={() => handleBlur(key)}
                    disabled={!isOwner}
                    aria-label={label}
                    title={reasoning ?? undefined}
                    className={cn(
                      'h-8 w-full rounded-md border border-input bg-transparent px-2.5 text-sm',
                      'transition-colors outline-none',
                      'placeholder:text-muted-foreground/60',
                      'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50',
                      'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
                      '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                      'dark:bg-input/30'
                    )}
                  />
                  {reasoning && badge === 'ai-suggested' && (
                    <p className="text-[11px] text-muted-foreground leading-snug">{reasoning}</p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer actions */}
          {isOwner && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground">
                Leave a field blank to use the default value shown as placeholder.
              </p>
              <button
                type="button"
                onClick={handleResetToDefaults}
                disabled={isSaving}
                className={cn(
                  'shrink-0 ml-3 text-xs text-muted-foreground underline underline-offset-2',
                  'transition-colors hover:text-foreground',
                  'disabled:pointer-events-none disabled:opacity-50',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded'
                )}
              >
                Reset to defaults
              </button>
            </div>
          )}

          {!isOwner && (
            <p className="text-xs text-muted-foreground">View only — you are not the deck owner.</p>
          )}
        </div>
      )}
    </div>
  )
}
