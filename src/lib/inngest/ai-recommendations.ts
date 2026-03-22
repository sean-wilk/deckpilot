import { inngest } from './client'
import { db } from '@/lib/db'
import { deckAnalyses, swapRecommendations, cards } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { streamStructuredOutput } from '@/lib/ai/providers'
import { buildDeckContext } from '@/lib/ai/context'
import { getRecommendationPrompt } from '@/lib/ai/prompts-recommendations'
import { SwapRecommendationSchema } from '@/lib/ai/schemas'
import type { SwapRecommendation } from '@/lib/ai/schemas'
import { toJSONSchema } from 'zod'

export const recommendCards = inngest.createFunction(
  { id: 'ai-deck-recommendations', retries: 1 },
  { event: 'ai/recommendations.requested' },
  async ({ event, step }) => {
    const { deckId, analysisId, focus, spiciness } = event.data as {
      deckId: string
      analysisId: string
      focus?: string
      spiciness?: number
    }

    try {
      // Step 1: Mark as processing
      await step.run('mark-processing', async () => {
        await db.update(deckAnalyses)
          .set({
            status: 'processing',
            results: {
              _progress: {
                currentStep: 1,
                totalSteps: 5,
                stepLabel: 'Starting recommendations...',
                startedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            },
          })
          .where(eq(deckAnalyses.id, analysisId))
      })

      // Step 2: Build context
      const context = await step.run('build-context', async () => {
        await db.update(deckAnalyses)
          .set({
            results: {
              _progress: {
                currentStep: 2,
                totalSteps: 5,
                stepLabel: 'Building deck context...',
                startedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            },
          })
          .where(eq(deckAnalyses.id, analysisId))
        return await buildDeckContext(deckId)
      })

      // Step 3: Build prompt
      const prompt = await step.run('build-prompt', async () => {
        await db.update(deckAnalyses)
          .set({
            results: {
              _progress: {
                currentStep: 3,
                totalSteps: 5,
                stepLabel: 'Preparing recommendation prompt...',
                startedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            },
          })
          .where(eq(deckAnalyses.id, analysisId))
        let p = getRecommendationPrompt({ ...context, spiciness })

        if (focus === 'synergy') {
          p += ' Focus specifically on improving card synergy and reducing dead cards.'
        } else if (focus === 'mana_base') {
          p += ' Focus specifically on improving the mana base, fixing, and land count.'
        } else if (focus === 'bracket_down') {
          p += ' Focus specifically on suggesting swaps to lower the deck\'s power level.'
        }

        return p
      })

      // Step 4: Call AI with streaming to avoid connection timeout
      const result = await step.run('call-ai', async () => {
        await db.update(deckAnalyses)
          .set({
            results: {
              _progress: {
                currentStep: 4,
                totalSteps: 5,
                stepLabel: 'AI is generating recommendations...',
                startedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            },
          })
          .where(eq(deckAnalyses.id, analysisId))
        const jsonSchema = toJSONSchema(SwapRecommendationSchema) as {
          properties?: Record<string, unknown>
          required?: string[]
        }
        const object = await streamStructuredOutput<SwapRecommendation>(
          'recommendations',
          prompt,
          jsonSchema,
          4096,
        )
        return { object }
      })

      // Step 5: Save recommendations — update analysis + insert all swap_recommendations rows
      await step.run('save-recommendations', async () => {
        await db.update(deckAnalyses)
          .set({
            results: { ...result.object, _completedAt: new Date().toISOString() },
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
          results: { _completedAt: new Date().toISOString(), _error: true },
        })
        .where(eq(deckAnalyses.id, analysisId))

      throw error
    }
  }
)
