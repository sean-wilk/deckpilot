'use client'

import { useEffect, useCallback, useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { CardImage } from '@/components/cards/card-image'
import { PrintingSelector } from '@/components/cards/printing-selector'
import { ManaSymbol } from '@/components/ui/mana-symbol'
import type { CardImageUris, CardFace } from '@/types/card'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CardDetailModalProps {
  card: {
    id: string
    name: string
    manaCost: string | null
    typeLine: string
    oracleText: string | null
    power: string | null
    toughness: string | null
    rarity: string
    setCode: string
    imageUris: CardImageUris | null
    cardFaces: CardFace[] | null
    prices: Record<string, string | null> | null
  }
  open: boolean
  onOpenChange: (open: boolean) => void
  printingSelector?: React.ReactNode
  aiActions?: React.ReactNode
  deckId?: string
  deckCardId?: string
  userNote?: string
  isOwner?: boolean
  isCommander?: boolean
  onRemove?: (deckCardId: string) => void
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReplacementCard {
  name: string
  reasoning: string
}

interface FindReplacementResult {
  replacements?: ReplacementCard[]
  error?: string
}

interface CardOpinionResult {
  opinion?: string
  error?: string
}

interface CardResultsResponse {
  cardOpinion?: { results: { opinion: string }; createdAt: string } | null
  cardReplacement?: { results: FindReplacementResult; createdAt: string } | null
}

// ─── AI Quick Actions ─────────────────────────────────────────────────────────

function formatAgo(ms: number): string {
  const secs = Math.floor(ms / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ago`
}

function AiQuickActions({
  deckId,
  cardName,
  triggerReplacementRef,
}: {
  deckId: string
  cardName: string
  triggerReplacementRef?: React.MutableRefObject<(() => void) | null>
}) {
  const [replacementLoading, setReplacementLoading] = useState(false)
  const [replacementResult, setReplacementResult] = useState<FindReplacementResult | null>(null)

  const [opinionLoading, setOpinionLoading] = useState(false)
  const [opinionResult, setOpinionResult] = useState<CardOpinionResult | null>(null)

  const [savedAt, setSavedAt] = useState<string | null>(null)

  const fetchFromServer = useCallback(async () => {
    try {
      const res = await fetch(`/api/ai/card-results/${deckId}/${encodeURIComponent(cardName)}`)
      if (!res.ok) return
      const data = (await res.json()) as CardResultsResponse
      if (data.cardOpinion) {
        setOpinionResult({ opinion: data.cardOpinion.results.opinion })
        setSavedAt(data.cardOpinion.createdAt)
      }
      if (data.cardReplacement) {
        setReplacementResult(data.cardReplacement.results)
        if (!data.cardOpinion) setSavedAt(data.cardReplacement.createdAt)
      }
    } catch {
      // ignore fetch errors
    }
  }, [deckId, cardName])

  // On mount, load from server
  useEffect(() => {
    void fetchFromServer()
  }, [fetchFromServer])

  const handleFindReplacement = useCallback(async () => {
    setReplacementLoading(true)
    setReplacementResult(null)
    try {
      const res = await fetch('/api/ai/find-replacement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deckId, cardName }),
      })
      const data = (await res.json()) as FindReplacementResult
      setReplacementResult(data)
      await fetchFromServer()
    } catch {
      setReplacementResult({ error: 'Failed to fetch replacements.' })
    } finally {
      setReplacementLoading(false)
    }
  }, [deckId, cardName, fetchFromServer])

  // Expose trigger to parent via ref so "Suggest Swap" button can invoke it
  useEffect(() => {
    if (triggerReplacementRef) {
      triggerReplacementRef.current = handleFindReplacement
    }
  }, [triggerReplacementRef, handleFindReplacement])

  const handleCardOpinion = useCallback(async () => {
    setOpinionLoading(true)
    setOpinionResult(null)
    try {
      const res = await fetch('/api/ai/card-opinion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deckId, cardName }),
      })
      const data = (await res.json()) as CardOpinionResult
      setOpinionResult(data)
      await fetchFromServer()
    } catch {
      setOpinionResult({ error: 'Failed to fetch opinion.' })
    } finally {
      setOpinionLoading(false)
    }
  }, [deckId, cardName, fetchFromServer])

  return (
    <div className="space-y-4">
      {/* Server result timestamp */}
      {savedAt !== null && (
        <div className="flex items-center text-xs text-md-text-muted">
          <span>Results from {formatAgo(Date.now() - new Date(savedAt).getTime())}</span>
        </div>
      )}

      {/* Find Replacement + Ask AI — side by side */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleFindReplacement}
          disabled={replacementLoading}
          className={cn(
            'flex-1 h-9 px-3 rounded-lg text-sm font-medium',
            'bg-violet-600/20 border border-violet-500/30 text-violet-300',
            'hover:bg-violet-600/30 hover:text-violet-200',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-colors duration-150',
          )}
        >
          {replacementLoading ? 'Finding…' : 'Find Replacement'}
        </button>

        <button
          type="button"
          onClick={handleCardOpinion}
          disabled={opinionLoading}
          className={cn(
            'flex-1 h-9 px-3 rounded-lg text-sm font-medium',
            'bg-sky-600/20 border border-sky-500/30 text-sky-300',
            'hover:bg-sky-600/30 hover:text-sky-200',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-colors duration-150',
          )}
        >
          {opinionLoading ? 'Asking AI…' : 'Ask AI about this card'}
        </button>
      </div>

      {/* Results */}
      {replacementResult && (
        <div
          className={cn(
            'rounded-lg px-4 py-3',
            'bg-md-bg-subtle border border-md-border',
            'text-sm text-md-text-secondary',
          )}
        >
          {replacementResult.error ? (
            <p className="text-error">{replacementResult.error}</p>
          ) : replacementResult.replacements && replacementResult.replacements.length > 0 ? (
            <ul className="space-y-2">
              {replacementResult.replacements.map((r, i) => (
                <li key={i} className="space-y-0.5">
                  <p className="font-semibold text-md-text">{r.name}</p>
                  <p className="text-md-text-tertiary text-xs leading-relaxed">{r.reasoning}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-md-text-muted">No replacements found.</p>
          )}
        </div>
      )}

      {opinionResult && (
        <div
          className={cn(
            'rounded-lg px-4 py-3',
            'bg-md-bg-subtle border border-md-border',
            'text-sm text-md-text-secondary leading-relaxed whitespace-pre-wrap',
          )}
        >
          {opinionResult.error ? (
            <p className="text-error">{opinionResult.error}</p>
          ) : (
            <p>{opinionResult.opinion}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Mana Cost Display ────────────────────────────────────────────────────────

/**
 * Parses a Scryfall mana cost string like "{5}{R}{R}" into rendered symbols.
 * All tokens are rendered via Scryfall SVG images.
 */
function ManaCostDisplay({ manaCost }: { manaCost: string }) {
  // Split on the pattern {TOKEN} — keep the tokens
  const tokens = manaCost.match(/\{([^}]+)\}/g)?.map(t => t.slice(1, -1)) ?? []

  return (
    <span className="inline-flex items-center gap-0.5 flex-wrap">
      {tokens.map((token, i) => (
        <ManaSymbol key={i} symbol={token.toUpperCase()} size="sm" />
      ))}
    </span>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRarity(rarity: string): string {
  return rarity.charAt(0).toUpperCase() + rarity.slice(1)
}

function formatPrice(prices: Record<string, string | null> | null): string | null {
  if (!prices) return null
  const usd = prices.usd ?? prices['usd']
  if (usd != null) return `$${usd}`
  return null
}

// Splits oracle text into segments, wrapping parenthetical reminder text in
// italic spans while keeping the rest as plain text.
function OracleTextBlock({ text }: { text: string }) {
  // Each paragraph separated by newlines
  const paragraphs = text.split('\n')

  return (
    <div className="space-y-1.5">
      {paragraphs.map((para, pi) => {
        // Split on parenthetical groups: "(…)"
        const segments = para.split(/(\([^)]*\))/g)
        return (
          <p key={pi} className="leading-relaxed">
            {segments.map((seg, si) => {
              const isReminder = seg.startsWith('(') && seg.endsWith(')')
              return isReminder ? (
                <em key={si} className="text-md-text-muted not-italic italic">
                  {seg}
                </em>
              ) : (
                <span key={si}>{seg}</span>
              )
            })}
          </p>
        )
      })}
    </div>
  )
}

// ─── Close button ─────────────────────────────────────────────────────────────

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close card detail"
      className={cn(
        'absolute top-3 right-3 z-10',
        'flex items-center justify-center',
        'size-8 rounded-full',
        'bg-md-bg-raised text-md-text-secondary',
        'border border-md-border',
        'backdrop-blur-sm',
        'transition-all duration-150',
        'hover:bg-md-hover hover:text-md-text',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50',
        'active:scale-95',
      )}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4"
        aria-hidden="true"
      >
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    </button>
  )
}

// ─── Notes Textarea ───────────────────────────────────────────────────────────

function NotesTextarea({
  deckId,
  deckCardId,
  initialNote,
}: {
  deckId: string
  deckCardId: string
  initialNote: string
}) {
  const [note, setNote] = useState(initialNote)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const handleBlur = useCallback(async () => {
    if (note === initialNote && saveStatus === 'idle') return
    setSaveStatus('saving')
    try {
      const res = await fetch(`/api/decks/${deckId}/cards/${deckCardId}/note`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      })
      if (res.ok) {
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      } else {
        setSaveStatus('error')
      }
    } catch {
      setSaveStatus('error')
    }
  }, [deckId, deckCardId, note, initialNote, saveStatus])

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-xs font-semibold text-md-text-tertiary uppercase tracking-wider">
          Notes
        </label>
        <span className="text-xs text-md-text-muted italic">
          AI considers these when analyzing
        </span>
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={handleBlur}
        rows={3}
        placeholder="Add personal notes about this card…"
        className={cn(
          'w-full resize-none rounded-lg px-3 py-2',
          'bg-md-bg-subtle border border-md-border',
          'text-sm text-md-text-secondary placeholder:text-md-text-muted',
          'focus:outline-none focus:border-white/25 focus:bg-md-bg-subtle',
          'transition-colors duration-150',
        )}
      />
      {saveStatus !== 'idle' && (
        <p
          className={cn(
            'text-xs',
            saveStatus === 'saving' && 'text-md-text-muted',
            saveStatus === 'saved' && 'text-success',
            saveStatus === 'error' && 'text-error',
          )}
        >
          {saveStatus === 'saving' && 'Saving…'}
          {saveStatus === 'saved' && 'Saved'}
          {saveStatus === 'error' && 'Failed to save'}
        </p>
      )}
    </div>
  )
}

// ─── CardDetailModal ──────────────────────────────────────────────────────────

export function CardDetailModal({
  card,
  open,
  onOpenChange,
  printingSelector,
  aiActions,
  deckId,
  deckCardId,
  userNote,
  isOwner,
  isCommander,
  onRemove,
}: CardDetailModalProps) {
  const handleClose = useCallback(() => onOpenChange(false), [onOpenChange])
  const triggerReplacementRef = useRef<(() => void) | null>(null)

  // Keyboard: Escape to close
  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, handleClose])

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  const isCreature =
    card.power != null &&
    card.toughness != null &&
    card.typeLine.toLowerCase().includes('creature')

  const price = formatPrice(card.prices)

  return (
    // Overlay backdrop
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Card detail: ${card.name}`}
      className={cn(
        'fixed inset-0 z-50',
        'flex items-center justify-center',
        'p-4 sm:p-6 lg:p-8',
        // Dark overlay
        'bg-black/75 backdrop-blur-sm',
        // Fade-in
        'animate-in fade-in duration-200',
      )}
      // Click outside the inner panel to close
      onClick={handleClose}
    >
      {/* Inner panel — stop propagation so clicking inside doesn't close */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'modal-dark',
          'relative',
          'w-full max-w-4xl',
          'rounded-2xl overflow-hidden',
          'bg-md-bg border border-md-border',
          'shadow-2xl shadow-black/60',
          // Slide-up entrance
          'animate-in slide-in-from-bottom-4 duration-200',
          // Constrain modal height on smaller screens
          'max-h-[90vh] overflow-y-auto',
        )}
      >
        <CloseButton onClose={handleClose} />

        {/* ── TOP SECTION: two-column (image | details) ── */}
        <div className="flex flex-col sm:flex-row gap-0">

          {/* ── Left: card image ── */}
          <div
            className={cn(
              'flex-shrink-0',
              'flex items-start justify-center',
              'bg-zinc-950/60',
              'p-6 sm:p-8',
              // Fixed column width that comfortably fits the card
              'sm:w-[320px]',
            )}
          >
            {/* Hover wrapper — scales image up for readability */}
            <div
              className={cn(
                'transition-transform duration-300 ease-out',
                'hover:scale-105',
                'cursor-zoom-in',
                'relative overflow-hidden rounded-[4.75%/3.4%]',
              )}
              style={{ width: '280px', height: '392px' }}
            >
              <CardImage
                name={card.name}
                imageUris={card.imageUris}
                cardFaces={card.cardFaces}
                size="normal"
                className="!w-full !h-full"
              />
            </div>
          </div>

          {/* ── Right: card details ── */}
          <div
            className={cn(
              'flex-1 flex flex-col gap-5',
              'px-6 py-6 sm:px-8 sm:py-8',
              'text-md-text',
              'min-w-0',
            )}
          >
            {/* Card name + mana cost */}
            <div>
              <h2 className="text-2xl font-bold leading-tight tracking-tight text-md-text">
                {card.name}
              </h2>

              {/* Mana cost — parsed symbols */}
              {card.manaCost && (
                <div className="mt-2">
                  <ManaCostDisplay manaCost={card.manaCost} />
                </div>
              )}
            </div>

            {/* Type line */}
            <div className="border-t border-md-border pt-4">
              <p className="text-sm text-muted-foreground">
                {card.typeLine}
              </p>
            </div>

            {/* Oracle text */}
            {card.oracleText && (
              <div
                className={cn(
                  'rounded-lg px-4 py-3',
                  'bg-md-bg-subtle border border-md-border',
                  'text-sm text-md-text leading-relaxed',
                  'whitespace-pre-wrap',
                )}
              >
                <OracleTextBlock text={card.oracleText} />
              </div>
            )}

            {/* Power / Toughness */}
            {isCreature && (
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-widest text-md-text-muted font-semibold">
                  P/T
                </span>
                <span className="text-base font-bold text-md-text tabular-nums">
                  {card.power} / {card.toughness}
                </span>
              </div>
            )}

            {/* Rarity + Set + Price row */}
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span
                className={cn(
                  'px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider',
                  card.rarity === 'mythic'
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                    : card.rarity === 'rare'
                      ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                      : card.rarity === 'uncommon'
                        ? 'bg-slate-400/20 text-slate-300 border border-slate-400/30'
                        : 'bg-md-bg-raised text-md-text-muted border border-md-border',
                )}
              >
                {formatRarity(card.rarity)}
              </span>

              <span className="text-xs font-mono text-md-text-muted uppercase tracking-widest">
                {card.setCode}
              </span>

              {price && (
                <span className="ml-auto text-sm font-semibold text-success">
                  {price}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── BOTTOM SECTION: full-width actions ── */}
        <div
          className={cn(
            'border-t border-md-border',
            'px-6 py-6 sm:px-8 sm:py-6',
            'flex flex-col gap-5',
          )}
        >
          {/* Owner action bar: Remove + Suggest Swap */}
          {isOwner && !isCommander && deckCardId && onRemove && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  onRemove(deckCardId)
                  onOpenChange(false)
                }}
                className={cn(
                  'flex-1 h-9 px-3 rounded-lg text-sm font-medium',
                  'bg-error-muted border border-error-border text-error',
                  'hover:bg-error-muted/70 hover:text-error',
                  'transition-colors duration-150',
                )}
              >
                Remove from Deck
              </button>
              {deckId && (
                <button
                  type="button"
                  onClick={() => triggerReplacementRef.current?.()}
                  className={cn(
                    'flex-1 h-9 px-3 rounded-lg text-sm font-medium',
                    'bg-violet-600/20 border border-violet-500/30 text-violet-300',
                    'hover:bg-violet-600/30 hover:text-violet-200',
                    'transition-colors duration-150',
                  )}
                >
                  Suggest Swap
                </button>
              )}
            </div>
          )}

          {/* Notes */}
          {deckId && deckCardId && (
            <NotesTextarea
              deckId={deckId}
              deckCardId={deckCardId}
              initialNote={userNote ?? ''}
            />
          )}

          {/* AI quick actions */}
          {deckId && (
            <AiQuickActions deckId={deckId} cardName={card.name} triggerReplacementRef={triggerReplacementRef} />
          )}

          {/* Printing selector slot */}
          <div className="border-t border-md-border pt-5">
            {printingSelector ?? <PrintingSelector cardId={card.id} />}
          </div>

          {/* AI actions slot */}
          {aiActions && (
            <div className="border-t border-md-border pt-5">
              {aiActions}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
