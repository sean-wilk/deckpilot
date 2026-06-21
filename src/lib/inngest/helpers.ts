import { db } from '@/lib/db'
import { deckAnalyses, deckStructureAnalyses } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function setProgress(
  analysisId: string,
  currentStep: number,
  totalSteps: number,
  stepLabel: string,
  extraResults?: Record<string, unknown>
) {
  const now = new Date().toISOString()
  const [existing] = await db
    .select({ results: deckAnalyses.results })
    .from(deckAnalyses)
    .where(eq(deckAnalyses.id, analysisId))
    .limit(1)
  const prev = (existing?.results ?? {}) as Record<string, unknown>
  await db.update(deckAnalyses)
    .set({
      results: {
        ...prev,
        ...extraResults,
        _progress: { currentStep, totalSteps, stepLabel, startedAt: now, updatedAt: now },
      },
    })
    .where(eq(deckAnalyses.id, analysisId))
}

export async function markFailed(analysisId: string, error: unknown) {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const [existing] = await db
    .select({ results: deckAnalyses.results })
    .from(deckAnalyses)
    .where(eq(deckAnalyses.id, analysisId))
    .limit(1)
  const prev = (existing?.results ?? {}) as Record<string, unknown>
  await db.update(deckAnalyses)
    .set({
      status: 'failed',
      errorMessage,
      results: { ...prev, _completedAt: new Date().toISOString(), _error: true },
    })
    .where(eq(deckAnalyses.id, analysisId))
}

export async function setStructureProgress(
  structureAnalysisId: string,
  partialResults: Record<string, unknown>,
  progress: { currentStep: number; totalSteps: number; stepLabel: string }
) {
  const now = new Date().toISOString()
  const [existing] = await db
    .select({ results: deckStructureAnalyses.results })
    .from(deckStructureAnalyses)
    .where(eq(deckStructureAnalyses.id, structureAnalysisId))
    .limit(1)
  const prev = (existing?.results ?? {}) as Record<string, unknown>
  await db.update(deckStructureAnalyses)
    .set({
      results: {
        ...prev,
        ...partialResults,
        _progress: { ...progress, startedAt: now, updatedAt: now },
      },
    })
    .where(eq(deckStructureAnalyses.id, structureAnalysisId))
}

export async function markStructureFailed(structureAnalysisId: string, errorMessage: string) {
  const [existing] = await db
    .select({ results: deckStructureAnalyses.results })
    .from(deckStructureAnalyses)
    .where(eq(deckStructureAnalyses.id, structureAnalysisId))
    .limit(1)
  const prev = (existing?.results ?? {}) as Record<string, unknown>
  await db.update(deckStructureAnalyses)
    .set({
      status: 'failed',
      errorMessage,
      results: { ...prev, _completedAt: new Date().toISOString(), _error: true },
    })
    .where(eq(deckStructureAnalyses.id, structureAnalysisId))
}
