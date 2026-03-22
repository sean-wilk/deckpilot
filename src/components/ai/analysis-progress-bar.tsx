'use client'

interface AnalysisProgressBarProps {
  currentStep: number
  totalSteps: number
  stepLabel: string
  variant?: 'default' | 'compact'
}

export function AnalysisProgressBar({
  currentStep,
  totalSteps,
  stepLabel,
  variant = 'default',
}: AnalysisProgressBarProps) {
  const percentage = Math.round((currentStep / totalSteps) * 100)

  if (variant === 'compact') {
    return (
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-interactive/70 rounded-full transition-all duration-500 animate-pulse"
          style={{ width: `${percentage}%` }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{stepLabel}</span>
        <span className="tabular-nums">{currentStep}/{totalSteps}</span>
      </div>
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-interactive/70 rounded-full transition-all duration-500 animate-pulse"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
