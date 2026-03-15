'use server'

import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { matchHistory, matchCardPerformance, decks } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function logMatch(deckId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const deck = await db.select().from(decks)
    .where(and(eq(decks.id, deckId), eq(decks.ownerId, user.id))).limit(1)
  if (!deck[0]) throw new Error('Deck not found')

  const result = formData.get('result') as string
  const playerCount = Number(formData.get('playerCount'))
  const turnCount = formData.get('turnCount') ? Number(formData.get('turnCount')) : null
  const notes = formData.get('notes') as string | null
  const opponents = formData.get('opponents') as string | null

  await db.insert(matchHistory).values({
    deckId,
    playedAt: new Date(),
    result,
    playerCount,
    turnCount,
    notes: notes || null,
    opponentCommanders: opponents ? opponents.split(',').map(s => s.trim()).filter(Boolean) : null,
  })

  revalidatePath(`/decks/${deckId}/matches`)
}

export async function getMatches(deckId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const deck = await db.select().from(decks)
    .where(and(eq(decks.id, deckId), eq(decks.ownerId, user.id))).limit(1)
  if (!deck[0]) throw new Error('Deck not found')

  return db.select().from(matchHistory)
    .where(eq(matchHistory.deckId, deckId))
    .orderBy(desc(matchHistory.playedAt))
}

export async function tagCardPerformance(
  matchId: string,
  performances: { cardId: string; performance: 'mvp' | 'underperformer'; note?: string }[]
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Verify the match belongs to a deck owned by the user
  const match = await db.select({ deckId: matchHistory.deckId })
    .from(matchHistory)
    .where(eq(matchHistory.id, matchId))
    .limit(1)
  if (!match[0]) throw new Error('Match not found')

  const deck = await db.select().from(decks)
    .where(and(eq(decks.id, match[0].deckId), eq(decks.ownerId, user.id)))
    .limit(1)
  if (!deck[0]) throw new Error('Not authorized')

  if (performances.length === 0) return

  await db.insert(matchCardPerformance).values(
    performances.map(({ cardId, performance, note }) => ({
      matchId,
      cardId,
      performance,
      note: note ?? null,
    }))
  )
}
