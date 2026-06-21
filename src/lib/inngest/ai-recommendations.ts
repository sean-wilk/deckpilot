import { inngest } from './client'
import { db } from '@/lib/db'
import { deckAnalyses, swapRecommendations, cards } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { streamStructuredOutput } from '@/lib/ai/providers'
import { buildDeckContext } from '@/lib/ai/context'
import { getRecommendationPrompt } from '@/lib/ai/prompts-recommendations'
import { setProgress, markFailed } from './helpers'
import { fuzzyMatchCardName } from '@/lib/ai/card-validation'
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
        await setProgress(analysisId, 2, 5, 'Building deck context...')
        return await buildDeckContext(deckId)
      })

      // Step 3: Build prompt
      const prompt = await step.run('build-prompt', async () => {
        await setProgress(analysisId, 3, 5, 'Preparing recommendation prompt...')
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
        await setProgress(analysisId, 4, 5, 'AI is generating recommendations...')
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
            const name = rec.card_out.trim()
            const [cardOut] = await db.select({ id: cards.id })
              .from(cards).where(sql`LOWER(${cards.name}) = LOWER(${name})`).limit(1)
            cardOutId = cardOut?.id ?? (await fuzzyMatchCardName(name))?.id ?? null
          }

          if (rec.card_in) {
            const name = rec.card_in.trim()
            const [cardIn] = await db.select({ id: cards.id })
              .from(cards).where(sql`LOWER(${cards.name}) = LOWER(${name})`).limit(1)
            cardInId = cardIn?.id ?? (await fuzzyMatchCardName(name))?.id ?? null
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
      await markFailed(analysisId, error)
      throw error
    }
  }
)
