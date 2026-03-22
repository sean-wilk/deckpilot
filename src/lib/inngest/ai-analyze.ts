import { inngest } from './client'
import { db } from '@/lib/db'
import { deckAnalyses } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { streamStructuredOutput } from '@/lib/ai/providers'
import { buildDeckContext } from '@/lib/ai/context'
import { getAnalysisPrompt } from '@/lib/ai/prompts'
import { DeckAnalysisSchema } from '@/lib/ai/schemas'
import type { DeckAnalysis } from '@/lib/ai/schemas'
import { toJSONSchema } from 'zod'

export const analyzeDeck = inngest.createFunction(
  { id: 'ai-deck-analysis', retries: 1 },
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

      // Step 4: Call AI with streaming to avoid connection timeout
      const result = await step.run('call-ai', async () => {
        const jsonSchema = toJSONSchema(DeckAnalysisSchema) as {
          properties?: Record<string, unknown>
          required?: string[]
        }
        const object = await streamStructuredOutput<DeckAnalysis>(
          'analysis',
          prompt,
          jsonSchema,
          4096,
        )
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
