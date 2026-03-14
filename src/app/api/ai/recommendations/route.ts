import { streamObject } from 'ai'
import { getAiModel } from '@/lib/ai/providers'
import { SwapRecommendationSchema } from '@/lib/ai/schemas'
import { buildDeckContext } from '@/lib/ai/context'
import { getRecommendationPrompt } from '@/lib/ai/prompts-recommendations'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { deckAnalyses, decks } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const { deckId } = await request.json()

    const deck = await db.select().from(decks)
      .where(and(eq(decks.id, deckId), eq(decks.ownerId, user.id)))
      .limit(1)
    if (!deck[0]) return new Response('Deck not found', { status: 404 })

    const model = await getAiModel('recommendations')
    const context = await buildDeckContext(deckId)
    const prompt = getRecommendationPrompt(context)

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
        }
      },
    })

    return result.toTextStreamResponse()
  } catch (error) {
    console.error('Recommendations error:', error)
    return new Response(JSON.stringify({ error: 'Recommendations failed' }), { status: 500 })
  }
}
