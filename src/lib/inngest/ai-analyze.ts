import { inngest } from './client'
import { db } from '@/lib/db'
import { deckAnalyses } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { generateObject } from 'ai'
import { getAiModel } from '@/lib/ai/providers'
import { buildDeckContext } from '@/lib/ai/context'
import { getAnalysisPrompt } from '@/lib/ai/prompts'
import { DeckAnalysisSchema } from '@/lib/ai/schemas'

export const analyzeDeck = inngest.createFunction(
  { id: 'ai-deck-analysis', retries: 2 },
  { event: 'ai/analyze.requested' },
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
        return getAnalysisPrompt(context)
      })

      // Step 4: Call AI
      const result = await step.run('call-ai', async () => {
        const model = await getAiModel('analysis')
        const { object, usage } = await generateObject({
          model,
          schema: DeckAnalysisSchema,
          prompt,
        })
        return { object, usage }
      })

      // Step 5: Save results
      await step.run('save-results', async () => {
        await db.update(deckAnalyses)
          .set({
            results: result.object,
            status: 'complete',
            promptTokens: result.usage?.inputTokens ?? 0,
            completionTokens: result.usage?.outputTokens ?? 0,
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
