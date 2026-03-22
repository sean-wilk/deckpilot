'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Layers, Clock, ChevronRight, Swords } from 'lucide-react'
import { useActiveJobs } from '@/hooks/use-active-jobs'
import { DeckCardStatusBadge } from '@/components/deck-card-status-badge'
import type { CardImageUris, CardFace } from '@/types/card'
import { BRACKET_LABELS, BRACKET_BADGE_COLORS } from '@/lib/constants/brackets'

interface DeckRow {
  id: string
  name: string
  targetBracket: number
  budgetLimitCents: number | null
  updatedAt: string  // serialized from server
  commander: {
    id: string
    name: string
    typeLine: string
    imageUris: CardImageUris | null
    cardFaces: CardFace[] | null
    colorIdentity: string[]
  } | null
  cardCount: number
}

function BracketBadge({ bracket }: { bracket: number }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs-plus font-semibold tracking-wide ${BRACKET_BADGE_COLORS[bracket] ?? 'bg-muted text-muted-foreground border-border'}`}
    >
      B{bracket} · {BRACKET_LABELS[bracket] ?? 'Unknown'}
    </span>
  )
}

function CommanderArt({ commander }: { commander: DeckRow['commander'] }) {
  if (!commander) {
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/60 flex items-center justify-center">
        <Swords className="size-8 text-muted-foreground/30" />
      </div>
    )
  }

  const face = commander.cardFaces?.[0]
  const uris = commander.imageUris ?? (face?.image_uris as CardImageUris | undefined) ?? null
  const artSrc = uris?.art_crop ?? uris?.normal ?? null

  if (!artSrc) {
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/60 flex items-center justify-center">
        <Swords className="size-8 text-muted-foreground/30" />
      </div>
    )
  }

  return (
    <div className="absolute inset-0">
      <Image
        src={artSrc}
        alt={commander.name}
        fill
        className="object-cover object-[center_20%] transition-transform duration-500 group-hover:scale-105"
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
      />
    </div>
  )
}

function formatTimeAgo(dateStr: string): string {
  const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return `${Math.floor(diffDays / 365)}y ago`
}

export function DecksGrid({ decks }: { decks: DeckRow[] }) {
  const { jobs } = useActiveJobs()

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {decks.map((deck) => {
        const deckJobs = jobs.filter((j) => j.deckId === deck.id)
        return (
          <Link
            key={deck.id}
            href={`/decks/${deck.id}`}
            className="group relative flex flex-col rounded-2xl overflow-hidden border border-border bg-card ring-1 ring-transparent hover:ring-foreground/20 hover:border-foreground/30 transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5"
          >
            {/* Art section */}
            <div className="relative h-36 overflow-hidden bg-muted">
              <CommanderArt commander={deck.commander} />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
              <div className="absolute top-2.5 right-2.5">
                <BracketBadge bracket={deck.targetBracket} />
              </div>
              {deck.commander && (
                <div className="absolute bottom-2 left-3 right-10">
                  <p className="text-xs-plus font-medium text-foreground/70 truncate leading-tight">
                    {deck.commander.name}
                  </p>
                </div>
              )}
              {/* Status badge for active jobs */}
              {deckJobs.length > 0 && <DeckCardStatusBadge jobs={deckJobs} />}
            </div>

            {/* Content */}
            <div className="flex flex-col gap-2 p-4 pt-3 flex-1">
              <h3 className="font-semibold text-sm leading-snug line-clamp-2">
                {deck.name}
              </h3>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-auto pt-1">
                <span className="flex items-center gap-1">
                  <Layers className="size-3.5" />
                  {deck.cardCount} cards
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="size-3.5" />
                  {formatTimeAgo(deck.updatedAt)}
                </span>
                <ChevronRight className="size-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
