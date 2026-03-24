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
  await db.update(deckAnalyses)
    .set({
      results: {
        ...extraResults,
        _progress: { currentStep, totalSteps, stepLabel, startedAt: now, updatedAt: now },
      },
    })
    .where(eq(deckAnalyses.id, analysisId))
}

export async function markFailed(analysisId: string, error: unknown) {
  const errorMessage = error instanceof Error ? error.message : String(error)
  await db.update(deckAnalyses)
    .set({
      status: 'failed',
      errorMessage,
      results: { _completedAt: new Date().toISOString(), _error: true },
    })
    .where(eq(deckAnalyses.id, analysisId))
}

export async function setStructureProgress(
  structureAnalysisId: string,
  partialResults: Record<string, unknown>,
  progress: { currentStep: number; totalSteps: number; stepLabel: string }
) {
  const now = new Date().toISOString()
  await db.update(deckStructureAnalyses)
    .set({
      results: {
        ...partialResults,
        _progress: { ...progress, startedAt: now, updatedAt: now },
      },
    })
    .where(eq(deckStructureAnalyses.id, structureAnalysisId))
}

export async function markStructureFailed(structureAnalysisId: string, errorMessage: string) {
  await db.update(deckStructureAnalyses)
    .set({
      status: 'failed',
      errorMessage,
      results: { _completedAt: new Date().toISOString(), _error: true },
    })
    .where(eq(deckStructureAnalyses.id, structureAnalysisId))
}
