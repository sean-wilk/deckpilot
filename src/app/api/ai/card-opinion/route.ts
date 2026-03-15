import { generateText } from 'ai'
import { getAiModel } from '@/lib/ai/providers'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { decks, cards } from '@/lib/db/schema'
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

    // Verify deck ownership and fetch deck + commander info
    const deckRows = await db
      .select({
        deckName: decks.name,
        targetBracket: decks.targetBracket,
        commanderName: cards.name,
      })
      .from(decks)
      .innerJoin(cards, eq(decks.commanderId, cards.id))
      .where(and(eq(decks.id, deckId), eq(decks.ownerId, user.id)))
      .limit(1)

    if (!deckRows[0]) {
      return new Response('Deck not found', { status: 404 })
    }

    const { deckName, targetBracket, commanderName } = deckRows[0]

    // Fetch the card's oracle text
    const cardRows = await db
      .select({ oracleText: cards.oracleText })
      .from(cards)
      .where(eq(cards.name, cardName))
      .limit(1)

    const oracleText = cardRows[0]?.oracleText ?? 'No oracle text available.'

    const prompt = `You are an expert MTG Commander analyst. The deck "${deckName}" is led by ${commanderName} targeting bracket ${targetBracket}. Give a brief (2-4 sentence) opinion on ${cardName} in this deck. Consider its synergy with the commander, its role, and whether it's a good fit. Card text: ${oracleText}`

    const model = await getAiModel('chat')

    const { text } = await generateText({
      model,
      prompt,
    })

    return new Response(
      JSON.stringify({ opinion: text }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Card opinion error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to generate card opinion' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
