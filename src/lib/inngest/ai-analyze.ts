import { inngest } from './client'
import { db } from '@/lib/db'
import { deckAnalyses } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { streamStructuredOutputWithProgress } from '@/lib/ai/providers'
import { buildDeckContext } from '@/lib/ai/context'
import { getAnalysisPrompt } from '@/lib/ai/prompts'
import { setProgress, markFailed } from './helpers'
import { DeckAnalysisSchema } from '@/lib/ai/schemas'
import type { DeckAnalysis } from '@/lib/ai/schemas'
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
                totalSteps: 5,
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
        await setProgress(analysisId, 2, 5, 'Building deck context...')
        return await buildDeckContext(deckId)
      })

      // Step 3: Build prompt
      const prompt = await step.run('build-prompt', async () => {
        await setProgress(analysisId, 3, 5, 'Preparing AI prompt...')
        return getAnalysisPrompt(context)
      })

      // Step 4: Call AI with progressive streaming
      const result = await step.run('call-ai-streaming', async () => {
        await setProgress(analysisId, 4, 5, 'AI analyzing deck...')

        const jsonSchema = toJSONSchema(DeckAnalysisSchema) as {
          properties?: Record<string, unknown>
          required?: string[]
        }

        const fieldLabels: Record<string, string> = {
          overall_assessment: 'Reading overall assessment...',
          bracket: 'Evaluating power level...',
          bracket_reasoning: 'Evaluating power level...',
          categories: 'Analyzing card categories...',
          strengths: 'Identifying strengths...',
          weaknesses: 'Finding weaknesses...',
          synergy_score: 'Evaluating synergies...',
          key_synergies: 'Evaluating synergies...',
          salt_total: 'Calculating salt score...',
          lands_analysis: 'Analyzing mana base...',
          land_count: 'Analyzing mana base...',
        }

        const totalExpectedKeys = 15 // approximate number of top-level keys in DeckAnalysis
        let reportedKeyCount = 0

        const onProgress = async (partial: Record<string, unknown>, newKeys: string[]) => {
          reportedKeyCount += newKeys.length
          const label = newKeys.reduce((best, k) => fieldLabels[k] ?? best, 'AI analyzing deck...')

          // Show section-based progress within the streaming step
          const sectionProgress = Math.min(reportedKeyCount, totalExpectedKeys)

          await db.update(deckAnalyses)
            .set({
              results: {
                ...partial,
                _partial: true,
                _progress: {
                  currentStep: 4,
                  totalSteps: 5,
                  stepLabel: `${label} (${sectionProgress}/${totalExpectedKeys} sections)`,
                  startedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              },
            })
            .where(eq(deckAnalyses.id, analysisId))
        }

        const object = await streamStructuredOutputWithProgress<DeckAnalysis>(
          'analysis',
          prompt,
          jsonSchema,
          8192,
          onProgress,
        )
        return { object }
      })

      // Step 5: Save final results
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
      await markFailed(analysisId, error)
      throw error
    }
  }
)
