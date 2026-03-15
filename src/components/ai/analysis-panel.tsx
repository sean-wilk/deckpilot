'use client'

import { useState, useCallback, useRef } from 'react'
import { DeckAnalysisSchema } from '@/lib/ai/schemas'
import type { DeckAnalysis } from '@/lib/ai/schemas'
import type { z } from 'zod'

// ─── useObject ────────────────────────────────────────────────────────────────
// Compatible implementation of the ai/react `useObject` hook API.
// Streams structured JSON from the API and progressively hydrates the object.

type UseObjectOptions<T extends z.ZodTypeAny> = {
  api: string
  schema: T
}

type UseObjectResult<T> = {
  object: Partial<T> | undefined
  isLoading: boolean
  error: Error | null
  submit: (body: Record<string, unknown>) => void
  stop: () => void
}

function useObject<T extends z.ZodTypeAny>(
  options: UseObjectOptions<T>
): UseObjectResult<z.infer<T>> {
  const { api } = options
  const [object, setObject] = useState<Partial<z.infer<T>> | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const stop = useCallback(() => {
    abortRef.current?.abort()
    setIsLoading(false)
  }, [])

  const submit = useCallback(
    async (body: Record<string, unknown>) => {
      setIsLoading(true)
      setError(null)
      setObject(undefined)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch(api, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        })

        if (!res.ok) {
          const err = new Error(`HTTP ${res.status}`)
          ;(err as Error & { status: number }).status = res.status as number
          throw err
        }

        const reader = res.body?.getReader()
        if (!reader) throw new Error('No response body')

        const decoder = new TextDecoder()
        let accumulated = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          accumulated += decoder.decode(value, { stream: true })

          // Attempt to parse whatever valid JSON we have so far by
          // progressively trying the accumulated string as a JSON object.
          // The AI SDK streams JSON using Server-Sent Events lines.
          const lines = accumulated.split('\n')
          let lastValidObject: Partial<z.infer<T>> | undefined

          for (const line of lines) {
            const trimmed = line.trim()
            // SSE data lines start with "0:" (text), "2:" (object chunk), etc.
            if (trimmed.startsWith('0:') || trimmed.startsWith('2:')) {
              try {
                const jsonStr = trimmed.slice(2)
                const parsed = JSON.parse(jsonStr) as z.infer<T>
                if (parsed && typeof parsed === 'object') {
                  lastValidObject = parsed as Partial<z.infer<T>>
                }
              } catch {
                // partial chunk — keep accumulating
              }
            }
          }

          // Also try parsing the whole accumulated buffer as JSON directly
          // (for non-SSE streaming responses)
          if (!lastValidObject) {
            try {
              const parsed = JSON.parse(accumulated) as z.infer<T>
              if (parsed && typeof parsed === 'object') {
                lastValidObject = parsed as Partial<z.infer<T>>
              }
            } catch {
              // still accumulating
            }
          }

          if (lastValidObject) {
            setObject(lastValidObject)
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        setIsLoading(false)
      }
    },
    [api]
  )

  return { object, isLoading, error, submit, stop }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<keyof DeckAnalysis['categories'], string> = {
  ramp: 'Ramp',
  card_draw: 'Card Draw',
  removal: 'Removal',
  board_wipes: 'Board Wipes',
  win_conditions: 'Win Conditions',
  protection: 'Protection',
  lands: 'Lands',
}

const RATING_COLORS: Record<string, string> = {
  deficient: 'text-red-500',
  low: 'text-orange-500',
  adequate: 'text-yellow-500',
  strong: 'text-green-500',
  excessive: 'text-blue-500',
}

const RATING_BG: Record<string, string> = {
  deficient: 'bg-red-500/10',
  low: 'bg-orange-500/10',
  adequate: 'bg-yellow-500/10',
  strong: 'bg-green-500/10',
  excessive: 'bg-blue-500/10',
}

function LoadingDots() {
  return (
    <span className="inline-flex gap-0.5">
      <span className="size-1 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
      <span className="size-1 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
      <span className="size-1 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
    </span>
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
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
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

function BracketBadge({ bracket }: { bracket: number }) {
  const colors = [
    '',
    'bg-green-500/15 text-green-600 dark:text-green-400',
    'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
    'bg-orange-500/15 text-orange-600 dark:text-orange-400',
    'bg-red-500/15 text-red-500',
  ]
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-bold ${colors[bracket] ?? ''}`}>
      B{bracket}
    </span>
  )
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full bg-blue-500/60 transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ─── Section Renderers ────────────────────────────────────────────────────────

function CategoryRow({
  label,
  cat,
}: {
  label: string
  cat: DeckAnalysis['categories'][keyof DeckAnalysis['categories']] | undefined
}) {
  if (!cat) return null
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-foreground font-medium tabular-nums">
            {cat.count}/{cat.target}
          </span>
          <span
            className={`text-[10px] px-1 py-0.5 rounded font-medium ${RATING_COLORS[cat.rating] ?? ''} ${RATING_BG[cat.rating] ?? ''}`}
          >
            {cat.rating}
          </span>
        </div>
      </div>
      {cat.notes && (
        <p className="text-[10px] text-muted-foreground leading-relaxed">{cat.notes}</p>
      )}
    </div>
  )
}

// ─── AnalysisPanel ────────────────────────────────────────────────────────────

interface AnalysisPanelProps {
  deckId: string
  cardCount: number
}

export function AnalysisPanel({ deckId, cardCount }: AnalysisPanelProps) {
  const { object, isLoading, error, submit, stop } = useObject({
    api: '/api/ai/analyze',
    schema: DeckAnalysisSchema,
  })

  const hasResult = !!object

  function handleAnalyze() {
    submit({ deckId })
  }

  // ── Error message ──
  let errorMessage: string | null = null
  if (error) {
    const status = (error as Error & { status?: number }).status
    if (status === 401) {
      errorMessage = 'AI not configured — visit /admin to set up a provider'
    } else if (status === 429) {
      errorMessage = 'AI is busy, retrying...'
    } else {
      errorMessage = 'Analysis failed. Try again.'
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="size-5 rounded bg-blue-500/10 flex items-center justify-center">
            <svg
              className="size-3 text-blue-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
              />
            </svg>
          </div>
          <span className="text-xs font-semibold">AI Analysis</span>
          {isLoading && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              Analyzing <LoadingDots />
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isLoading ? (
            <button
              type="button"
              onClick={stop}
              className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={cardCount < 10}
              className="rounded bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-medium px-2.5 py-1 transition-colors"
            >
              {hasResult ? 'Re-analyze' : 'Analyze Deck'}
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {errorMessage && (
        <div className="px-4 py-3 bg-red-500/5 border-b border-red-500/20">
          <p className="text-[11px] text-red-500">{errorMessage}</p>
        </div>
      )}

      {/* Loading skeleton (no result yet) */}
      {isLoading && !hasResult && (
        <div className="px-4 py-4 space-y-2.5">
          {[80, 60, 90, 50, 70].map((w, i) => (
            <div
              key={i}
              className="h-2 rounded-full bg-muted animate-pulse"
              style={{ width: `${w}%`, animationDelay: `${i * 100}ms` }}
            />
          ))}
        </div>
      )}

      {/* Results */}
      {hasResult && object && (
        <div className="divide-y divide-border">
          {/* Overall Assessment */}
          {object.overall_assessment && (
            <div className="px-4 py-3">
              <p className="text-[11px] leading-relaxed text-foreground">
                {object.overall_assessment}
              </p>
            </div>
          )}

          {/* Power Level */}
          {object.power_level_estimate && (
            <CollapsibleSection title="Power Level" defaultOpen>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <BracketBadge bracket={object.power_level_estimate.bracket} />
                  <div className="flex-1">
                    <ProgressBar
                      value={Math.round(object.power_level_estimate.confidence * 100)}
                      max={100}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {Math.round(object.power_level_estimate.confidence * 100)}% conf.
                  </span>
                </div>
                {object.power_level_estimate.reasoning && (
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    {object.power_level_estimate.reasoning}
                  </p>
                )}
              </div>
            </CollapsibleSection>
          )}

          {/* Categories */}
          {object.categories && (
            <CollapsibleSection title="Categories" defaultOpen>
              <div className="space-y-3">
                {(
                  Object.entries(CATEGORY_LABELS) as [
                    keyof DeckAnalysis['categories'],
                    string,
                  ][]
                ).map(([key, label]) => (
                  <CategoryRow
                    key={key}
                    label={label}
                    cat={object.categories?.[key]}
                  />
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Mana Base */}
          {object.mana_base && (
            <CollapsibleSection title="Mana Base">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Land Count</span>
                  <span className="text-[11px] font-medium tabular-nums">
                    {object.mana_base.land_count}
                    {object.mana_base.recommended_land_count
                      ? ` / ${object.mana_base.recommended_land_count} rec.`
                      : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Fixing Quality</span>
                  <span
                    className={`text-[10px] px-1 py-0.5 rounded font-medium ${
                      {
                        poor: 'text-red-500 bg-red-500/10',
                        fair: 'text-orange-500 bg-orange-500/10',
                        good: 'text-yellow-500 bg-yellow-500/10',
                        excellent: 'text-green-500 bg-green-500/10',
                      }[object.mana_base.fixing_quality] ?? ''
                    }`}
                  >
                    {object.mana_base.fixing_quality}
                  </span>
                </div>
                {object.mana_base.notes && (
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    {object.mana_base.notes}
                  </p>
                )}
              </div>
            </CollapsibleSection>
          )}

          {/* Synergy */}
          {object.synergy && (
            <CollapsibleSection title="Synergy">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">Score</span>
                  <div className="flex-1">
                    <ProgressBar value={object.synergy.score} max={10} />
                  </div>
                  <span className="text-[11px] font-medium tabular-nums">
                    {object.synergy.score}/10
                  </span>
                </div>

                {object.synergy.key_synergies && object.synergy.key_synergies.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      Key Synergies
                    </span>
                    {object.synergy.key_synergies.map((s, i) => (
                      <div key={i} className="text-[10px] text-muted-foreground leading-relaxed">
                        <span className="text-foreground font-medium">
                          {s.cards?.join(' + ')}
                        </span>
                        {s.description && ` — ${s.description}`}
                      </div>
                    ))}
                  </div>
                )}

                {object.synergy.detected_combos && object.synergy.detected_combos.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      Combos
                    </span>
                    {object.synergy.detected_combos.map((c, i) => (
                      <div key={i} className="text-[10px] leading-relaxed">
                        <span className="text-foreground font-medium">
                          {c.cards?.join(' + ')}
                        </span>
                        {c.is_infinite && (
                          <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-red-500/10 text-red-500 font-medium">
                            Infinite
                          </span>
                        )}
                        {c.description && (
                          <p className="text-muted-foreground mt-0.5">{c.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {object.synergy.dead_cards && object.synergy.dead_cards.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      Dead Cards
                    </span>
                    {object.synergy.dead_cards.map((d, i) => (
                      <div key={i} className="text-[10px] text-muted-foreground leading-relaxed">
                        <span className="text-foreground font-medium">{d.card}</span>
                        {d.reasoning && ` — ${d.reasoning}`}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CollapsibleSection>
          )}

          {/* Strengths & Weaknesses */}
          {(object.strengths || object.weaknesses) && (
            <CollapsibleSection title="Strengths & Weaknesses">
              <div className="space-y-3">
                {object.strengths && object.strengths.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">
                      Strengths
                    </span>
                    <ul className="space-y-1">
                      {object.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
                          <span className="mt-0.5 size-1.5 rounded-full bg-green-500/60 shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {object.weaknesses && object.weaknesses.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-medium text-red-500 uppercase tracking-wide">
                      Weaknesses
                    </span>
                    <ul className="space-y-1">
                      {object.weaknesses.map((w, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
                          <span className="mt-0.5 size-1.5 rounded-full bg-red-500/60 shrink-0" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CollapsibleSection>
          )}

          {/* Salt Assessment */}
          {object.salt_assessment && (
            <CollapsibleSection title="Salt Assessment">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Total Salt</span>
                  <span className="text-[11px] font-medium tabular-nums">
                    {typeof object.salt_assessment.total_salt === 'number'
                      ? object.salt_assessment.total_salt.toFixed(1)
                      : object.salt_assessment.total_salt}
                  </span>
                </div>
                {object.salt_assessment.high_salt_cards &&
                  object.salt_assessment.high_salt_cards.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                        High Salt Cards
                      </span>
                      {object.salt_assessment.high_salt_cards.map((c, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-[10px]"
                        >
                          <span className="text-foreground">{c.card}</span>
                          <span className="text-orange-500 tabular-nums font-medium">
                            {typeof c.salt_score === 'number'
                              ? c.salt_score.toFixed(2)
                              : c.salt_score}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                {object.salt_assessment.notes && (
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    {object.salt_assessment.notes}
                  </p>
                )}
              </div>
            </CollapsibleSection>
          )}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !hasResult && !errorMessage && (
        <div className="px-4 py-5 text-center">
          <p className="text-[11px] text-muted-foreground">
            {cardCount < 10
              ? `Add ${10 - cardCount} more cards to enable analysis`
              : 'Click Analyze Deck to get AI-powered insights'}
          </p>
        </div>
      )}
    </div>
  )
}
