'use client'

import { useEffect, useCallback, useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { CardImage } from '@/components/cards/card-image'
import { PrintingSelector } from '@/components/cards/printing-selector'
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

// ─── AI Quick Actions ─────────────────────────────────────────────────────────

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
    } catch {
      setReplacementResult({ error: 'Failed to fetch replacements.' })
    } finally {
      setReplacementLoading(false)
    }
  }, [deckId, cardName])

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
    } catch {
      setOpinionResult({ error: 'Failed to fetch opinion.' })
    } finally {
      setOpinionLoading(false)
    }
  }, [deckId, cardName])

  return (
    <div className="space-y-4">
      {/* Find Replacement */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={handleFindReplacement}
          disabled={replacementLoading}
          className={cn(
            'w-full px-3 py-2 rounded-lg text-sm font-medium',
            'bg-violet-600/20 border border-violet-500/30 text-violet-300',
            'hover:bg-violet-600/30 hover:text-violet-200',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-all duration-150',
          )}
        >
          {replacementLoading ? 'Finding replacements…' : 'Find Replacement'}
        </button>

        {replacementResult && (
          <div
            className={cn(
              'rounded-lg px-4 py-3',
              'bg-white/5 border border-white/8',
              'text-sm text-white/75',
            )}
          >
            {replacementResult.error ? (
              <p className="text-red-400">{replacementResult.error}</p>
            ) : replacementResult.replacements && replacementResult.replacements.length > 0 ? (
              <ul className="space-y-2">
                {replacementResult.replacements.map((r, i) => (
                  <li key={i} className="space-y-0.5">
                    <p className="font-semibold text-white/90">{r.name}</p>
                    <p className="text-white/55 text-xs leading-relaxed">{r.reasoning}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-white/50">No replacements found.</p>
            )}
          </div>
        )}
      </div>

      {/* Ask AI about this card */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={handleCardOpinion}
          disabled={opinionLoading}
          className={cn(
            'w-full px-3 py-2 rounded-lg text-sm font-medium',
            'bg-sky-600/20 border border-sky-500/30 text-sky-300',
            'hover:bg-sky-600/30 hover:text-sky-200',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-all duration-150',
          )}
        >
          {opinionLoading ? 'Asking AI…' : 'Ask AI about this card'}
        </button>

        {opinionResult && (
          <div
            className={cn(
              'rounded-lg px-4 py-3',
              'bg-white/5 border border-white/8',
              'text-sm text-white/75 leading-relaxed whitespace-pre-wrap',
            )}
          >
            {opinionResult.error ? (
              <p className="text-red-400">{opinionResult.error}</p>
            ) : (
              <p>{opinionResult.opinion}</p>
            )}
          </div>
        )}
      </div>
    </div>
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
                <em key={si} className="text-white/50 not-italic italic">
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
        'bg-white/10 text-white/70',
        'border border-white/15',
        'backdrop-blur-sm',
        'transition-all duration-150',
        'hover:bg-white/20 hover:text-white',
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

// ─── CardDetailModal ──────────────────────────────────────────────────────────

export function CardDetailModal({
  card,
  open,
  onOpenChange,
  printingSelector,
  aiActions,
  deckId,
  deckCardId,
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
          'relative',
          'w-full max-w-5xl',
          'rounded-2xl overflow-hidden',
          'bg-zinc-900 border border-white/10',
          'shadow-2xl shadow-black/60',
          // Slide-up entrance
          'animate-in slide-in-from-bottom-4 duration-200',
          // Constrain modal height on smaller screens
          'max-h-[90vh] overflow-y-auto',
        )}
      >
        <CloseButton onClose={handleClose} />

        {/* Two-column layout: image left, details right — stacked on mobile */}
        <div className="flex flex-col sm:flex-row gap-0">

          {/* ── Left: card image ── */}
          <div
            className={cn(
              'flex-shrink-0',
              'flex items-center justify-center',
              'bg-zinc-950/60',
              'p-6 sm:p-8',
              // On mobile: centered; on sm+: left column
              'sm:w-[300px]',
            )}
          >
            <CardImage
              name={card.name}
              imageUris={card.imageUris}
              cardFaces={card.cardFaces}
              size="normal"
            />
          </div>

          {/* ── Right: details ── */}
          <div
            className={cn(
              'flex-1 flex flex-col gap-5',
              'p-6 sm:p-8',
              'text-white',
              'min-w-0',
            )}
          >
            {/* Card name */}
            <div>
              <h2 className="text-2xl font-bold leading-tight tracking-tight text-white">
                {card.name}
              </h2>

              {/* Mana cost */}
              {card.manaCost && (
                <p className="mt-1 text-sm font-mono text-white/60 tracking-wider">
                  {card.manaCost}
                </p>
              )}
            </div>

            {/* Type line */}
            <div className="border-t border-white/10 pt-4">
              <p className="text-sm font-semibold text-white/80 uppercase tracking-wider">
                {card.typeLine}
              </p>
            </div>

            {/* Oracle text */}
            {card.oracleText && (
              <div
                className={cn(
                  'rounded-lg px-4 py-3',
                  'bg-white/5 border border-white/8',
                  'text-sm text-white/75',
                  'whitespace-pre-wrap',
                )}
              >
                <OracleTextBlock text={card.oracleText} />
              </div>
            )}

            {/* Power / Toughness */}
            {isCreature && (
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-widest text-white/40 font-semibold">
                  P/T
                </span>
                <span className="text-base font-bold text-white tabular-nums">
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
                        : 'bg-white/10 text-white/50 border border-white/15',
                )}
              >
                {formatRarity(card.rarity)}
              </span>

              <span className="text-xs font-mono text-white/40 uppercase tracking-widest">
                {card.setCode}
              </span>

              {price && (
                <span className="ml-auto text-sm font-semibold text-emerald-400">
                  {price}
                </span>
              )}
            </div>

            {/* Owner action bar: Remove + Suggest Swap */}
            {isOwner && !isCommander && deckCardId && onRemove && (
              <div className="border-t border-white/10 pt-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onRemove(deckCardId)
                      onOpenChange(false)
                    }}
                    className={cn(
                      'flex-1 px-3 py-2 rounded-lg text-sm font-medium',
                      'bg-red-600/20 border border-red-500/30 text-red-400',
                      'hover:bg-red-600/30 hover:text-red-300',
                      'transition-all duration-150',
                    )}
                  >
                    Remove from Deck
                  </button>
                  {deckId && (
                    <button
                      type="button"
                      onClick={() => triggerReplacementRef.current?.()}
                      className={cn(
                        'flex-1 px-3 py-2 rounded-lg text-sm font-medium',
                        'bg-violet-600/20 border border-violet-500/30 text-violet-300',
                        'hover:bg-violet-600/30 hover:text-violet-200',
                        'transition-all duration-150',
                      )}
                    >
                      Suggest Swap
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* AI quick actions */}
            {deckId && (
              <div className="border-t border-white/10 pt-4">
                <AiQuickActions deckId={deckId} cardName={card.name} triggerReplacementRef={triggerReplacementRef} />
              </div>
            )}

            {/* Printing selector slot */}
            <div className="border-t border-white/10 pt-4">
              {printingSelector ?? <PrintingSelector cardId={card.id} />}
            </div>

            {/* AI actions slot */}
            {aiActions && (
              <div className="border-t border-white/10 pt-4">
                {aiActions}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
