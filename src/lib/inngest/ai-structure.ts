import { inngest } from './client'
import { db } from '@/lib/db'
import { deckStructureAnalyses, deckCards, cards, decks } from '@/lib/db/schema'
import { eq, and, ne } from 'drizzle-orm'
import { streamStructuredOutput } from '@/lib/ai/providers'
import { getStructureStrategyPrompt, getStructureAssignmentPrompt } from '@/lib/ai/structure-prompts'
import type { StructurePromptContext } from '@/lib/ai/structure-prompts'
import { setStructureProgress, markStructureFailed } from './helpers'
import {
  StructureStrategySchema,
  StructureAssignmentSchema,
} from '@/lib/ai/structure-schemas'
import type { StructureStrategy, StructureAssignment } from '@/lib/ai/structure-schemas'
import { toJSONSchema } from 'zod'
import { deleteAiCategories, insertCardCategories, getCardCategoriesForDeck } from '@/lib/queries/card-categories'

export const structureDeck = inngest.createFunction(
  { id: 'structure-deck', retries: 1, concurrency: { limit: 2 } },
  { event: 'ai/structure.requested' },
  async ({ event, step }) => {
    const { deckId, structureAnalysisId } = event.data as {
      deckId: string
      structureAnalysisId: string
    }

    try {
      // Step 1: Mark as processing
      await step.run('init', async () => {
        await db.update(deckStructureAnalyses)
          .set({
            status: 'processing',
            results: {
              _progress: {
                currentStep: 1,
                totalSteps: 6,
                stepLabel: 'Starting structure analysis...',
                startedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            },
          })
          .where(eq(deckStructureAnalyses.id, structureAnalysisId))
      })

      // Step 2: Build context from deck data
      const { context, deckCardIdMap } = await step.run('build-context', async () => {
        await setStructureProgress(structureAnalysisId, {}, {
          currentStep: 2,
          totalSteps: 6,
          stepLabel: 'Building deck context...',
        })

        // Fetch deck with commander info
        const [deck] = await db.select().from(decks).where(eq(decks.id, deckId)).limit(1)
        if (!deck) throw new Error('Deck not found')

        const [commander] = await db.select().from(cards).where(eq(cards.id, deck.commanderId)).limit(1)
        if (!commander) throw new Error('Commander not found')

        // Fetch all deck cards with card details, including deckCardId for later persistence
        const deckCardRows = await db
          .select({
            deckCardId: deckCards.id,
            name: cards.name,
            typeLine: cards.typeLine,
            oracleText: cards.oracleText,
            manaCost: cards.manaCost,
            isCommander: deckCards.isCommander,
            board: deckCards.board,
          })
          .from(deckCards)
          .innerJoin(cards, eq(deckCards.cardId, cards.id))
          .where(and(eq(deckCards.deckId, deckId), ne(deckCards.board, 'maybe')))

        // Build name → deckCardId map once, reused in persist step
        const nameToId: Record<string, string> = {}
        for (const row of deckCardRows) {
          nameToId[row.name] = row.deckCardId
        }

        // Get existing manual overrides
        const existingCategories = await getCardCategoriesForDeck(deckId)
        const manualOverrides = existingCategories
          .filter(c => c.isManualOverride)
          .map(c => ({ cardName: c.cardName, category: c.category }))

        const promptContext: StructurePromptContext = {
          commanderName: commander.name,
          commanderColorIdentity: commander.colorIdentity,
          // Map db rows to prompt context shape (board → isSideboard for prompt filtering)
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          cards: deckCardRows.map(({ deckCardId, board, ...card }) => ({
            ...card,
            isSideboard: board === 'side',
          })),
          philosophy: deck.philosophy,
          archetype: deck.archetype,
          targetBracket: deck.targetBracket,
          categoryTargets: deck.categoryTargets as Record<string, number> | null,
          customCategories: deck.customCategories,
          manualOverrides,
        }

        return { context: promptContext, deckCardIdMap: nameToId }
      })

      // Step 3: Phase 1 — Strategy analysis (categories + targets)
      const phase1 = await step.run('phase1-strategy', async () => {
        await setStructureProgress(structureAnalysisId, {}, {
          currentStep: 3,
          totalSteps: 6,
          stepLabel: 'AI analyzing deck structure...',
        })

        const prompt = getStructureStrategyPrompt(context)
        const jsonSchema = toJSONSchema(StructureStrategySchema) as {
          properties?: Record<string, unknown>
          required?: string[]
        }

        const strategy = await streamStructuredOutput<StructureStrategy>(
          'structure_strategy',
          prompt,
          jsonSchema,
          4096,
        )

        // Persist Phase 1 results with updated step label
        await setStructureProgress(structureAnalysisId, { strategy }, {
          currentStep: 4,
          totalSteps: 6,
          stepLabel: 'Structure strategy complete',
        })

        return strategy
      })

      // Step 4: Phase 2 — Card assignment
      const phase2 = await step.run('phase2-assignment', async () => {
        await setStructureProgress(structureAnalysisId, { strategy: phase1 }, {
          currentStep: 4,
          totalSteps: 6,
          stepLabel: 'AI assigning cards to categories...',
        })

        const prompt = getStructureAssignmentPrompt(context, phase1.categories)
        const jsonSchema = toJSONSchema(StructureAssignmentSchema) as {
          properties?: Record<string, unknown>
          required?: string[]
        }

        const assignments = await streamStructuredOutput<StructureAssignment>(
          'structure_assignment',
          prompt,
          jsonSchema,
          8192,
        )

        return assignments
      })

      // Step 5: Persist card category assignments
      await step.run('persist-assignments', async () => {
        await setStructureProgress(structureAnalysisId, { strategy: phase1 }, {
          currentStep: 5,
          totalSteps: 6,
          stepLabel: 'Saving card assignments...',
        })

        // Delete old AI-generated categories (preserves manual overrides)
        await deleteAiCategories(deckId)

        // Combine assignments + landAssignments, resolve to deckCardIds
        const insertRows: {
          deckCardId: string
          category: string
          isManualOverride: boolean
          source: string
        }[] = []

        for (const assignment of [...phase2.assignments, ...phase2.landAssignments]) {
          const deckCardId = deckCardIdMap[assignment.cardName]
          if (!deckCardId) {
            console.warn(`[structure-deck] Card not found in deck: "${assignment.cardName}"`)
            continue
          }
          for (const category of assignment.categories) {
            insertRows.push({
              deckCardId,
              category,
              isManualOverride: false,
              source: 'ai-structure',
            })
          }
        }

        await insertCardCategories(insertRows)
      })

      // Step 6: Mark complete
      await step.run('complete', async () => {
        // Update category currentCount from actual assignments
        const finalCategories = await getCardCategoriesForDeck(deckId)
        const countBySlug: Record<string, number> = {}
        for (const row of finalCategories) {
          countBySlug[row.category] = (countBySlug[row.category] ?? 0) + 1
        }

        const updatedStrategy = {
          ...phase1,
          categories: phase1.categories.map(cat => ({
            ...cat,
            currentCount: countBySlug[cat.slug] ?? 0,
          })),
        }

        await db.update(deckStructureAnalyses)
          .set({
            status: 'complete',
            results: {
              strategy: updatedStrategy,
              assignments: phase2,
              _completedAt: new Date().toISOString(),
            },
          })
          .where(eq(deckStructureAnalyses.id, structureAnalysisId))
      })

      return { success: true, structureAnalysisId }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      await markStructureFailed(structureAnalysisId, errorMessage)
      throw error
    }
  }
)
