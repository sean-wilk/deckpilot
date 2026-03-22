import { inngest } from './client'
import { db } from '@/lib/db'
import { deckAnalyses } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { streamStructuredOutput } from '@/lib/ai/providers'
import { buildDeckContext } from '@/lib/ai/context'
import { getAnalysisPrompt } from '@/lib/ai/prompts'
import { getAnalysisHeadlinePrompt } from '@/lib/ai/prompts'
import { DeckAnalysisSchema, DeckAnalysisHeadlineSchema } from '@/lib/ai/schemas'
import type { DeckAnalysis, DeckAnalysisHeadline } from '@/lib/ai/schemas'
import { toJSONSchema } from 'zod'

export const analyzeDeck = inngest.createFunction(
  { id: 'ai-deck-analysis', retries: 1 },
  { event: 'ai/analyze.requested' },
  async ({ event, step }) => {
    const { deckId, analysisId } = event.data as { deckId: string; analysisId: string }

    try {
      // Step 1: Mark as processing + initial progress
      await step.run('mark-processing', async () => {
        const now = new Date().toISOString()
        await db.update(deckAnalyses)
          .set({
            status: 'processing',
            results: {
              _progress: {
                currentStep: 1,
                totalSteps: 6,
                stepLabel: 'Starting analysis...',
                startedAt: now,
                updatedAt: now,
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
                totalSteps: 6,
                stepLabel: 'Building deck context...',
                startedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            },
          })
          .where(eq(deckAnalyses.id, analysisId))
        return await buildDeckContext(deckId)
      })

      // Step 3: Build prompts (both headline and full)
      const prompts = await step.run('build-prompt', async () => {
        await db.update(deckAnalyses)
          .set({
            results: {
              _progress: {
                currentStep: 3,
                totalSteps: 6,
                stepLabel: 'Preparing AI prompts...',
                startedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            },
          })
          .where(eq(deckAnalyses.id, analysisId))
        const headlinePrompt = getAnalysisHeadlinePrompt(context)
        const fullPrompt = getAnalysisPrompt(context)
        return { headlinePrompt, fullPrompt }
      })

      // Step 4: Quick AI call for headline fields (bracket, strengths, weaknesses)
      const headlines = await step.run('call-ai-headlines', async () => {
        await db.update(deckAnalyses)
          .set({
            results: {
              _progress: {
                currentStep: 4,
                totalSteps: 6,
                stepLabel: 'AI analyzing deck overview...',
                startedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            },
          })
          .where(eq(deckAnalyses.id, analysisId))

        const jsonSchema = toJSONSchema(DeckAnalysisHeadlineSchema) as {
          properties?: Record<string, unknown>
          required?: string[]
        }
        const object = await streamStructuredOutput<DeckAnalysisHeadline>(
          'analysis',
          prompts.headlinePrompt,
          jsonSchema,
          2048,
        )

        // Save partial results immediately — UI picks these up
        await db.update(deckAnalyses)
          .set({
            results: {
              ...object,
              _partial: true,
              _progress: {
                currentStep: 4,
                totalSteps: 6,
                stepLabel: 'Headlines ready, completing full analysis...',
                startedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            },
          })
          .where(eq(deckAnalyses.id, analysisId))

        return { object }
      })

      // Step 5: Full AI call for complete analysis
      const result = await step.run('call-ai-full', async () => {
        await db.update(deckAnalyses)
          .set({
            results: {
              ...headlines.object,
              _partial: true,
              _progress: {
                currentStep: 5,
                totalSteps: 6,
                stepLabel: 'AI completing full analysis...',
                startedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            },
          })
          .where(eq(deckAnalyses.id, analysisId))

        const jsonSchema = toJSONSchema(DeckAnalysisSchema) as {
          properties?: Record<string, unknown>
          required?: string[]
        }
        const object = await streamStructuredOutput<DeckAnalysis>(
          'analysis',
          prompts.fullPrompt,
          jsonSchema,
          6144,
        )
        return { object }
      })

      // Step 6: Save final results
      await step.run('save-results', async () => {
        await db.update(deckAnalyses)
          .set({
            results: { ...result.object, _completedAt: new Date().toISOString() },
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
          results: { _completedAt: new Date().toISOString(), _error: true },
        })
        .where(eq(deckAnalyses.id, analysisId))

      throw error
    }
  }
)
