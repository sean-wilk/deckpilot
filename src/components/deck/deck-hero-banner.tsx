'use client'

import Image from 'next/image'
import { Crown } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  BRACKET_LABELS,
  BRACKET_BADGE_COLORS,
} from '@/lib/constants/brackets'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DeckHeroBannerProps {
  deck: { name: string; targetBracket: number; archetype: string | null }
  commanderImageUris: Record<string, string> | null
  commanderCardFaces: Array<{ image_uris?: Record<string, string> }> | null
  commanderName: string
  partnerImageUris?: Record<string, string> | null
  partnerName?: string
  cardCount: number
}

// ─── Bracket fallback gradient backgrounds ────────────────────────────────────

const BRACKET_FALLBACK_GRADIENTS: Record<number, string> = {
  1: 'from-emerald-950 via-slate-900 to-slate-950',
  2: 'from-blue-950 via-slate-900 to-slate-950',
  3: 'from-amber-950 via-slate-900 to-slate-950',
  4: 'from-red-950 via-slate-900 to-slate-950',
  5: 'from-purple-950 via-slate-900 to-slate-950',
}

// ─── Commander Card ────────────────────────────────────────────────────────────

function CommanderCard({
  imageUris,
  name,
  isCrown = false,
}: {
  imageUris: Record<string, string> | null | undefined
  name: string
  isCrown?: boolean
}) {
  const src = imageUris?.normal ?? null

  return (
    <div className="relative flex flex-col items-center gap-1">
      {isCrown && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-amber-400 text-amber-950 rounded-full p-0.5 shadow-lg shadow-amber-500/40">
            <Crown className="size-3.5" />
          </div>
        </div>
      )}
      <div
        className={cn(
          'relative overflow-hidden rounded-lg shadow-2xl shadow-black/60',
          'border border-white/10',
          'w-[72px] h-[100px] md:w-[90px] md:h-[126px]',
          'transition-transform duration-200 hover:scale-105',
        )}
      >
        {src ? (
          <Image
            src={src}
            alt={name}
            fill
            sizes="(max-width: 768px) 72px, 90px"
            className="object-cover object-top"
          />
        ) : (
          <div className="w-full h-full bg-slate-800 flex items-center justify-center">
            <span className="text-[9px] text-slate-400 text-center px-1 leading-tight">
              {name}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── DeckHeroBanner ───────────────────────────────────────────────────────────

export function DeckHeroBanner({
  deck,
  commanderImageUris,
  commanderCardFaces,
  commanderName,
  partnerImageUris,
  partnerName,
  cardCount,
}: DeckHeroBannerProps) {
  // Resolve art_crop: prefer top-level image_uris, fall back to first DFC face
  const artCrop =
    commanderImageUris?.art_crop ??
    commanderCardFaces?.[0]?.image_uris?.art_crop ??
    null

  const bracketLabel = BRACKET_LABELS[deck.targetBracket] ?? `Bracket ${deck.targetBracket}`
  const bracketColor = BRACKET_BADGE_COLORS[deck.targetBracket] ?? BRACKET_BADGE_COLORS[2]
  const fallbackGradient =
    BRACKET_FALLBACK_GRADIENTS[deck.targetBracket] ?? BRACKET_FALLBACK_GRADIENTS[2]

  const hasPartner = Boolean(partnerName)

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden',
        'h-[200px] md:h-[240px]',
        // Fallback gradient when no art crop
        !artCrop && cn('bg-gradient-to-br', fallbackGradient),
      )}
    >
      {/* ── Art crop background ─────────────────────────────────────────────── */}
      {artCrop && (
        <Image
          src={artCrop}
          alt={`${commanderName} art`}
          fill
          sizes="100vw"
          className="object-cover object-center"
          priority
        />
      )}

      {/* ── Dark gradient overlay for text readability ───────────────────────── */}
      <div
        className={cn(
          'absolute inset-0',
          'bg-gradient-to-t from-background via-background/70 to-transparent',
          // Side vignette for extra depth
          'after:absolute after:inset-0 after:bg-gradient-to-r after:from-background/60 after:via-transparent after:to-background/20',
        )}
        aria-hidden="true"
      />

      {/* ── Noise texture overlay ────────────────────────────────────────────── */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
        aria-hidden="true"
      />

      {/* ── Content layer ────────────────────────────────────────────────────── */}
      <div className="absolute inset-0 flex items-end">
        <div className="relative w-full flex items-end gap-4 px-4 md:px-6 pb-4">

          {/* Commander card(s) — bottom-left, slightly outside the hero edge */}
          <div className="flex items-end gap-2 shrink-0 translate-y-6 md:translate-y-8">
            <CommanderCard
              imageUris={commanderImageUris ?? commanderCardFaces?.[0]?.image_uris}
              name={commanderName}
              isCrown
            />
            {hasPartner && partnerName && (
              <CommanderCard
                imageUris={partnerImageUris ?? undefined}
                name={partnerName}
              />
            )}
          </div>

          {/* Text + badges */}
          <div className="flex-1 min-w-0 pb-1">
            {/* Deck title */}
            <h1
              className={cn(
                'text-xl md:text-2xl lg:text-3xl font-bold',
                'text-white leading-tight truncate',
              )}
              style={{
                textShadow: '0 2px 12px rgba(0,0,0,0.8), 0 1px 3px rgba(0,0,0,0.9)',
              }}
            >
              {deck.name}
            </h1>

            {/* Badges row */}
            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
              {/* Bracket badge */}
              <span
                className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-full',
                  'text-[10px] font-semibold border shrink-0',
                  bracketColor,
                )}
              >
                B{deck.targetBracket} — {bracketLabel}
              </span>

              {/* Archetype badge */}
              {deck.archetype && (
                <span
                  className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-full shrink-0',
                    'text-[10px] font-medium border',
                    'bg-white/10 text-white/80 border-white/20',
                  )}
                >
                  {deck.archetype}
                </span>
              )}

              {/* Card count badge */}
              <span
                className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-full shrink-0',
                  'text-[10px] font-medium border',
                  cardCount === 100
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : cardCount > 100
                    ? 'bg-red-500/20 text-red-300 border-red-500/30'
                    : 'bg-white/10 text-white/70 border-white/20',
                )}
              >
                {cardCount} / 100 cards
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
