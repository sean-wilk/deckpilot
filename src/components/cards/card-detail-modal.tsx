'use client'

import { useEffect, useCallback } from 'react'
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
}: CardDetailModalProps) {
  const handleClose = useCallback(() => onOpenChange(false), [onOpenChange])

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
          'w-full max-w-3xl',
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
              'sm:w-[calc(488px+4rem)]',
            )}
          >
            <CardImage
              name={card.name}
              imageUris={card.imageUris}
              cardFaces={card.cardFaces}
              size="large"
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
