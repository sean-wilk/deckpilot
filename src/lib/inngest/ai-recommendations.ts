import { inngest } from './client'
import { db } from '@/lib/db'
import { deckAnalyses, swapRecommendations, cards } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { chat } from '@tanstack/ai'
import { getAiModel } from '@/lib/ai/providers'
import { buildDeckContext } from '@/lib/ai/context'
import { getRecommendationPrompt } from '@/lib/ai/prompts-recommendations'
import { SwapRecommendationSchema } from '@/lib/ai/schemas'

export const recommendCards = inngest.createFunction(
  { id: 'ai-deck-recommendations', retries: 2 },
  { event: 'ai/recommendations.requested' },
  async ({ event, step }) => {
    const { deckId, analysisId, focus, wildcardMode } = event.data as {
      deckId: string
      analysisId: string
      focus?: string
      wildcardMode?: boolean
    }

    try {
      // Step 1: Mark as processing
      await step.run('mark-processing', async () => {
        await db.update(deckAnalyses)
          .set({ status: 'processing' })
          .where(eq(deckAnalyses.id, analysisId))
      })

      // Step 2: Build context
      const context = await step.run('build-context', async () => {
        return await buildDeckContext(deckId)
      })

      // Step 3: Build prompt
      const prompt = await step.run('build-prompt', async () => {
        let p = getRecommendationPrompt({ ...context, wildcardMode: wildcardMode === true })

        if (focus === 'synergy') {
          p += ' Focus specifically on improving card synergy and reducing dead cards.'
        } else if (focus === 'mana_base') {
          p += ' Focus specifically on improving the mana base, fixing, and land count.'
        } else if (focus === 'bracket_down') {
          p += ' Focus specifically on suggesting swaps to lower the deck\'s power level.'
        }

        return p
      })

      // Step 4: Call AI
      const result = await step.run('call-ai', async () => {
        const { model } = await getAiModel('recommendations')
        const object = await chat({
          adapter: model,
          messages: [{ role: 'user', content: prompt }],
          outputSchema: SwapRecommendationSchema,
        })
        return { object }
      })

      // Step 5: Save recommendations — update analysis + insert all swap_recommendations rows
      await step.run('save-recommendations', async () => {
        await db.update(deckAnalyses)
          .set({
            results: result.object,
            status: 'complete',
            promptTokens: 0,
            completionTokens: 0,
          })
          .where(eq(deckAnalyses.id, analysisId))

        const recs = result.object.recommendations ?? []
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
            analysisId,
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
      })

      return { success: true, analysisId }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      await db.update(deckAnalyses)
        .set({
          status: 'failed',
          errorMessage,
        })
        .where(eq(deckAnalyses.id, analysisId))

      throw error
    }
  }
)
