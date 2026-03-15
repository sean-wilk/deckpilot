import { streamObject } from 'ai'
import { getAiModel } from '@/lib/ai/providers'
import { SwapRecommendationSchema } from '@/lib/ai/schemas'
import { buildDeckContext } from '@/lib/ai/context'
import { getRecommendationPrompt } from '@/lib/ai/prompts-recommendations'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { deckAnalyses, decks, swapRecommendations, cards } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const { deckId, focus } = await request.json()

    const deck = await db.select().from(decks)
      .where(and(eq(decks.id, deckId), eq(decks.ownerId, user.id)))
      .limit(1)
    if (!deck[0]) return new Response('Deck not found', { status: 404 })

    const model = await getAiModel('recommendations')
    const context = await buildDeckContext(deckId)
    let prompt = getRecommendationPrompt(context)

    if (focus === 'synergy') {
      prompt += ' Focus specifically on improving card synergy and reducing dead cards.'
    } else if (focus === 'mana_base') {
      prompt += ' Focus specifically on improving the mana base, fixing, and land count.'
    } else if (focus === 'bracket_down') {
      prompt += ' Focus specifically on suggesting swaps to lower the deck\'s power level.'
    }

    const [analysis] = await db.insert(deckAnalyses).values({
      deckId,
      analysisType: 'swap_suggestion',
      aiProvider: 'configured',
      aiModel: 'configured',
      promptTokens: 0,
      completionTokens: 0,
      costCents: 0,
      results: {},
      status: 'streaming',
    }).returning()

    const result = streamObject({
      model,
      schema: SwapRecommendationSchema,
      prompt,
      onFinish: async ({ object, usage }) => {
        if (object) {
          await db.update(deckAnalyses)
            .set({
              results: object,
              status: 'complete',
              promptTokens: usage?.inputTokens ?? 0,
              completionTokens: usage?.outputTokens ?? 0,
            })
            .where(eq(deckAnalyses.id, analysis.id))

          // Insert individual recommendations into swap_recommendations table
          const recs = object.recommendations ?? []
          for (let i = 0; i < recs.length; i++) {
            const rec = recs[i]

            let cardOutId: string | null = null
            let cardInId: string | null = null

            if (rec.card_out) {
              const [cardOut] = await db.select({ id: cards.id })
                .from(cards).where(eq(cards.name, rec.card_out)).limit(1)
              cardOutId = cardOut?.id ?? null
            }

            if (rec.card_in) {
              const [cardIn] = await db.select({ id: cards.id })
                .from(cards).where(eq(cards.name, rec.card_in)).limit(1)
              cardInId = cardIn?.id ?? null
            }

            await db.insert(swapRecommendations).values({
              analysisId: analysis.id,
              tier: rec.tier,
              cardOutId,
              cardInId,
              reasoning: rec.reasoning,
              impactSummary: rec.impact_summary,
              tags: rec.tags,
              sortOrder: i,
              accepted: null,
            })
          }
        }
      },
    })

    return result.toTextStreamResponse()
  } catch (error) {
    console.error('Recommendations error:', error)
    return new Response(JSON.stringify({ error: 'Recommendations failed' }), { status: 500 })
  }
}
