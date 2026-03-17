import { chat } from '@tanstack/ai'
import { getAiModel } from '@/lib/ai/providers'
import { FindReplacementSchema } from '@/lib/ai/schemas'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { decks, cards, deckAnalyses } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const { deckId, cardName } = await request.json()

    if (!deckId || !cardName) {
      return new Response(
        JSON.stringify({ error: 'deckId and cardName are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Verify deck ownership
    const deck = await db
      .select()
      .from(decks)
      .where(and(eq(decks.id, deckId), eq(decks.ownerId, user.id)))
      .limit(1)
    if (!deck[0]) return new Response('Deck not found', { status: 404 })

    // Get commander name if available
    let commanderName = 'unknown commander'
    if (deck[0].commanderId) {
      const commander = await db
        .select({ name: cards.name })
        .from(cards)
        .where(eq(cards.id, deck[0].commanderId))
        .limit(1)
      if (commander[0]) commanderName = commander[0].name
    }

    const prompt = `Given the deck "${deck[0].name}" with commander ${commanderName}, suggest 3-5 replacement cards for "${cardName}". Consider the deck's strategy and the card's role. For each replacement, provide the card name, reasoning for the swap, synergy notes with the deck, and an estimated price in USD if known.`

    const { model, provider, modelId } = await getAiModel('recommendations')

    const object = await chat({
      adapter: model,
      messages: [{ role: 'user', content: prompt }],
      outputSchema: FindReplacementSchema,
    })

    await db.insert(deckAnalyses).values({
      deckId,
      analysisType: 'card_replacement',
      cardName,
      aiProvider: provider,
      aiModel: modelId,
      promptTokens: 0,
      completionTokens: 0,
      costCents: 0,
      results: object,
      status: 'complete',
    })

    return new Response(JSON.stringify(object), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Find replacement error:', error)
    return new Response(
      JSON.stringify({ error: 'Find replacement failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
