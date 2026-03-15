import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { db } from '@/lib/db'
import { decks, cards, deckCards } from '@/lib/db/schema'
import { eq, count, inArray } from 'drizzle-orm'
import { buttonVariants } from '@/components/ui/button-variants'
import { Plus, Layers, Clock, ChevronRight, Swords } from 'lucide-react'
import type { CardImageUris, CardFace } from '@/types/card'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DeckRow {
  id: string
  name: string
  targetBracket: number
  budgetLimitCents: number | null
  updatedAt: Date
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

// ─── Bracket badge ────────────────────────────────────────────────────────────

const BRACKET_LABELS: Record<number, string> = {
  1: 'Casual',
  2: 'Focused',
  3: 'Optimized',
  4: 'cEDH',
}

const BRACKET_COLORS: Record<number, string> = {
  1: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  2: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
  3: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  4: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
}

function BracketBadge({ bracket }: { bracket: number }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide ${BRACKET_COLORS[bracket] ?? 'bg-muted text-muted-foreground border-border'}`}
    >
      B{bracket} · {BRACKET_LABELS[bracket] ?? 'Unknown'}
    </span>
  )
}

// ─── Commander art ────────────────────────────────────────────────────────────

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

// ─── Deck grid card ───────────────────────────────────────────────────────────

function DeckCard({ deck }: { deck: DeckRow }) {
  return (
    <Link
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
            <p className="text-[11px] font-medium text-foreground/70 truncate leading-tight">
              {deck.commander.name}
            </p>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2 p-4 pt-3 flex-1">
        <h3 className="font-semibold text-base leading-snug line-clamp-2">
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
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-24 text-center">
      <div className="relative mb-6">
        <div className="size-20 rounded-2xl bg-muted flex items-center justify-center">
          <Swords className="size-9 text-muted-foreground/50" />
        </div>
        <div className="absolute -bottom-1 -right-1 size-6 rounded-full bg-primary flex items-center justify-center">
          <Plus className="size-3.5 text-primary-foreground" />
        </div>
      </div>
      <h2 className="text-xl font-semibold mb-2">No decks yet</h2>
      <p className="text-muted-foreground text-sm max-w-xs mb-6">
        Build your first Commander deck and start tracking its evolution.
      </p>
      <Link href="/decks/new" className={buttonVariants()}>
        <Plus className="size-4 mr-1.5" />
        Create your first deck
      </Link>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeAgo(date: Date): string {
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return `${Math.floor(diffDays / 365)}y ago`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DecksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch decks joined with commander card
  const rows = await db
    .select({
      id: decks.id,
      name: decks.name,
      targetBracket: decks.targetBracket,
      budgetLimitCents: decks.budgetLimitCents,
      updatedAt: decks.updatedAt,
      commanderId: cards.id,
      commanderName: cards.name,
      commanderTypeLine: cards.typeLine,
      commanderImageUris: cards.imageUris,
      commanderCardFaces: cards.cardFaces,
      commanderColorIdentity: cards.colorIdentity,
    })
    .from(decks)
    .leftJoin(cards, eq(decks.commanderId, cards.id))
    .where(eq(decks.ownerId, user.id))
    .orderBy(decks.updatedAt)

  // Fetch card counts for all decks in one query
  const deckIds = rows.map((r) => r.id)
  const countRows =
    deckIds.length > 0
      ? await db
          .select({ deckId: deckCards.deckId, total: count() })
          .from(deckCards)
          .where(inArray(deckCards.deckId, deckIds))
          .groupBy(deckCards.deckId)
      : []

  const countMap = new Map(countRows.map((r) => [r.deckId, r.total]))

  const deckList: DeckRow[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    targetBracket: row.targetBracket,
    budgetLimitCents: row.budgetLimitCents,
    updatedAt: row.updatedAt,
    commander: row.commanderId
      ? {
          id: row.commanderId,
          name: row.commanderName!,
          typeLine: row.commanderTypeLine!,
          imageUris: row.commanderImageUris as CardImageUris | null,
          cardFaces: row.commanderCardFaces as CardFace[] | null,
          colorIdentity: row.commanderColorIdentity as string[],
        }
      : null,
    cardCount: countMap.get(row.id) ?? 0,
  }))

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Decks</h1>
          {deckList.length > 0 && (
            <p className="text-muted-foreground text-sm mt-1">
              {deckList.length} {deckList.length === 1 ? 'deck' : 'decks'}
            </p>
          )}
        </div>
        <Link
          href="/decks/new"
          className={buttonVariants()}
        >
          <Plus className="size-4 mr-1.5" />
          New Deck
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {deckList.length === 0 ? (
          <EmptyState />
        ) : (
          deckList.map((deck) => <DeckCard key={deck.id} deck={deck} />)
        )}
      </div>
    </div>
  )
}
