'use client'

import { AnalysisProgressBar } from '@/components/ai/analysis-progress-bar'

interface DeckCardStatusBadgeProps {
  jobs: Array<{
    analysisType: string
    status: string
    progress: { currentStep: number; totalSteps: number; stepLabel: string } | null
  }>
}

export function DeckCardStatusBadge({ jobs }: DeckCardStatusBadgeProps) {
  if (jobs.length === 0) return null

  return (
    <div className="absolute bottom-0 left-0 right-0 p-2 space-y-1">
      {jobs.map((job) => {
        const label = job.analysisType === 'full' ? 'Analyzing' : 'Recommending'
        return (
          <div
            key={job.analysisType}
            className="flex items-center gap-2 rounded-md bg-card/90 backdrop-blur-sm border border-border/50 px-2 py-1.5"
          >
            <span className="relative flex size-2 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-interactive opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-interactive" />
            </span>
            {job.progress ? (
              <div className="flex-1 min-w-0">
                <AnalysisProgressBar
                  currentStep={job.progress.currentStep}
                  totalSteps={job.progress.totalSteps}
                  stepLabel={job.progress.stepLabel}
                  variant="compact"
                />
              </div>
            ) : (
              <span className="text-[10px] text-muted-foreground truncate">
                {label}…
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
