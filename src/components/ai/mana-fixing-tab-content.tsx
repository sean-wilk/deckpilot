'use client'

import { usePollAnalysis } from '@/hooks/use-poll-analysis'
import { AnalysisProgressBar } from '@/components/ai/analysis-progress-bar'
import { LandsSection } from '@/components/ai/lands-section'
import { toast } from 'sonner'
import type { LandsAnalysis } from '@/lib/ai/schemas'

interface ManaFixingTabContentProps {
  deckId: string
  deckCardNames?: string[]
}

export function ManaFixingTabContent({ deckId }: ManaFixingTabContentProps) {
  const { data, isPolling, error, trigger, cancel } = usePollAnalysis<LandsAnalysis>(deckId, 'mana_fixing')

  const isLoading = isPolling || data?.status === 'pending' || data?.status === 'processing'
  const isFailed = data?.status === 'failed'
  const isComplete = data?.status === 'complete'
  const analysis = data?.results as LandsAnalysis | undefined

  async function handleRunAnalysis() {
    await trigger({ deckId })
  }

  function handleCancel() {
    cancel()
    toast.info('Mana analysis cancelled')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="size-7 rounded-md bg-interactive-muted flex items-center justify-center shrink-0">
            <svg className="size-4 text-interactive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.893 13.393l-1.135-1.135a2.252 2.252 0 01-.421-.585l-1.08-2.16a.414.414 0 00-.663-.107.827.827 0 01-.812.21l-1.273-.363a.89.89 0 00-.738 1.595l.587.39c.59.395.674 1.23.172 1.732l-.2.2c-.212.212-.33.498-.33.796v.41c0 .409-.11.809-.32 1.158l-1.315 2.191a2.11 2.11 0 01-1.81 1.025 1.055 1.055 0 01-1.055-1.055v-1.172c0-.92-.56-1.747-1.414-2.089l-.655-.261a2.25 2.25 0 01-1.383-2.46l.007-.042a2.25 2.25 0 01.29-.787l.09-.15a2.25 2.25 0 012.37-1.048l1.178.236a1.125 1.125 0 001.302-.795l.208-.73a1.125 1.125 0 00-.578-1.315l-.665-.332-.091.091a2.25 2.25 0 01-1.591.659h-.18c-.249 0-.487.1-.662.274a.931.931 0 01-1.458-1.137l1.411-2.353a2.25 2.25 0 00.286-.76m11.928 9.869A9 9 0 008.965 3.525m11.928 9.868A9 9 0 118.965 3.525" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Mana Fixing</h2>
            {isLoading && data?.progress && (
              <div className="w-48">
                <AnalysisProgressBar
                  currentStep={data.progress.currentStep}
                  totalSteps={data.progress.totalSteps}
                  stepLabel={data.progress.stepLabel}
                />
              </div>
            )}
            {isLoading && !data?.progress && (
              <p className="text-xs-plus text-muted-foreground">Analyzing mana base...</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isLoading ? (
            <button
              type="button"
              onClick={handleCancel}
              className="rounded border border-error-border bg-error-muted hover:bg-error-muted/80 text-error text-xs font-medium px-3 py-1.5 transition-colors"
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRunAnalysis}
              className="rounded bg-interactive hover:bg-interactive-hover active:bg-interactive-hover text-interactive-foreground text-xs font-medium px-3 py-1.5 transition-colors"
            >
              {isComplete ? 'Re-analyze' : 'Run Mana Analysis'}
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {(error || isFailed) && (
        <div className="rounded-lg border border-error-border bg-error-muted px-4 py-3">
          <p className="text-sm text-error">
            {error?.message ?? data?.errorMessage ?? 'Mana analysis failed. Try again.'}
          </p>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && !analysis && (
        <div className="space-y-4">
          {data?.progress ? (
            <div className="rounded-lg border border-interactive/30 bg-interactive-muted/30 p-4">
              <AnalysisProgressBar
                currentStep={data.progress.currentStep}
                totalSteps={data.progress.totalSteps}
                stepLabel={data.progress.stepLabel}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {[75, 55, 85, 65].map((w, i) => (
                <div
                  key={i}
                  className="h-24 rounded-lg bg-muted animate-pulse"
                  style={{ animationDelay: `${i * 80}ms` }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !analysis && !isFailed && !error && (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
          <div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <svg className="size-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.893 13.393l-1.135-1.135a2.252 2.252 0 01-.421-.585l-1.08-2.16a.414.414 0 00-.663-.107.827.827 0 01-.812.21l-1.273-.363a.89.89 0 00-.738 1.595l.587.39c.59.395.674 1.23.172 1.732l-.2.2c-.212.212-.33.498-.33.796v.41c0 .409-.11.809-.32 1.158l-1.315 2.191a2.11 2.11 0 01-1.81 1.025 1.055 1.055 0 01-1.055-1.055v-1.172c0-.92-.56-1.747-1.414-2.089l-.655-.261a2.25 2.25 0 01-1.383-2.46l.007-.042a2.25 2.25 0 01.29-.787l.09-.15a2.25 2.25 0 012.37-1.048l1.178.236a1.125 1.125 0 001.302-.795l.208-.73a1.125 1.125 0 00-.578-1.315l-.665-.332-.091.091a2.25 2.25 0 01-1.591.659h-.18c-.249 0-.487.1-.662.274a.931.931 0 01-1.458-1.137l1.411-2.353a2.25 2.25 0 00.286-.76m11.928 9.869A9 9 0 008.965 3.525m11.928 9.868A9 9 0 118.965 3.525" />
            </svg>
          </div>
          <h3 className="text-sm font-medium mb-1">No mana analysis yet</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Run a detailed analysis of your mana base, color production, and fixing quality.
          </p>
          <button
            type="button"
            onClick={handleRunAnalysis}
            className="rounded bg-interactive hover:bg-interactive-hover text-interactive-foreground text-xs font-medium px-4 py-2 transition-colors"
          >
            Run Mana Analysis
          </button>
        </div>
      )}

      {/* Results */}
      {analysis && (
        <LandsSection
          landsAnalysis={analysis}
          fixingQuality={analysis.fixing_quality ?? 'unknown'}
          deckId={deckId}
          onRecommendDualLands={async () => {
            try {
              await trigger({ deckId })
            } catch (err) {
              console.error('Failed to request mana analysis', err)
            }
          }}
          onFillWithBasics={() => {
            // TODO: implement fill-with-basics
          }}
        />
      )}
    </div>
  )
}
