import { inngest } from './client'
import { db } from '@/lib/db'
import { deckAnalyses } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { chat } from '@tanstack/ai'
import { getAiModel } from '@/lib/ai/providers'
import { buildDeckContext } from '@/lib/ai/context'
import { getManaFixingPrompt } from '@/lib/ai/prompts-mana-fixing'
import { SwapRecommendationSchema } from '@/lib/ai/schemas'

export const manaFixingAnalysis = inngest.createFunction(
  { id: 'ai-mana-fixing', retries: 2 },
  { event: 'ai/mana-fixing.requested' },
  async ({ event, step }) => {
    const { deckId, analysisId } = event.data as { deckId: string; analysisId: string }

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
        return getManaFixingPrompt(context)
      })

      // Step 4: Call AI
      const result = await step.run('call-ai', async () => {
        const { model } = await getAiModel('analysis')
        const object = await chat({
          adapter: model,
          messages: [{ role: 'user', content: prompt }],
          outputSchema: SwapRecommendationSchema,
        })
        return { object }
      })

      // Step 5: Save results
      await step.run('save-results', async () => {
        await db.update(deckAnalyses)
          .set({
            results: result.object,
            status: 'complete',
            promptTokens: 0,
            completionTokens: 0,
          })
          .where(eq(deckAnalyses.id, analysisId))
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
