import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { decks, cards, deckCards } from '@/lib/db/schema'
import { eq, count, inArray } from 'drizzle-orm'
import { buttonVariants } from '@/components/ui/button-variants'
import { Plus, Swords } from 'lucide-react'
import type { CardImageUris, CardFace } from '@/types/card'
import { DecksGrid } from '@/components/decks-grid'

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
      <h2 className="text-lg font-semibold mb-2">No decks yet</h2>
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

      {deckList.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <EmptyState />
        </div>
      ) : (
        <DecksGrid decks={deckList.map(d => ({ ...d, updatedAt: d.updatedAt.toISOString() }))} />
      )}
    </div>
  )
}
