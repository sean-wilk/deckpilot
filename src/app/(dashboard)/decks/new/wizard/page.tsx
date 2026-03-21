'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { StepCommander, type WizardState } from '@/components/deck-wizard/step-commander'
import { StepDetails } from '@/components/deck-wizard/step-details'
import { StepGenerate } from '@/components/deck-wizard/step-generate'
import { cn } from '@/lib/utils'

// ─── StepIndicator ────────────────────────────────────────────────────────────

function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((label, i) => {
        const stepNum = i + 1
        const isActive = stepNum === current
        const isComplete = stepNum < current
        return (
          <div key={label} className="flex items-center gap-2">
            {i > 0 && (
              <div className={cn('h-px w-8', isComplete ? 'bg-primary' : 'bg-muted')} />
            )}
            <div
              className={cn(
                'flex items-center gap-1.5',
                isActive && 'text-primary font-medium',
                isComplete && 'text-primary',
                !isActive && !isComplete && 'text-muted-foreground'
              )}
            >
              <div
                className={cn(
                  'size-6 rounded-full flex items-center justify-center text-xs',
                  isActive && 'bg-primary text-primary-foreground',
                  isComplete && 'bg-primary text-primary-foreground',
                  !isActive && !isComplete && 'bg-muted text-muted-foreground'
                )}
              >
                {isComplete ? '✓' : stepNum}
              </div>
              <span className="text-sm">{label}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── WizardPage ───────────────────────────────────────────────────────────────

const initialState: WizardState = {
  commander: null,
  theme: '',
  name: '',
  description: '',
  bracket: null,
  budget: '',
  spiciness: 30,
  generationMode: 'fast',
}

export default function WizardPage() {
  const [step, setStep] = useState(1)
  const [wizardState, setWizardState] = useState<WizardState>(initialState)

  function handleStepUpdate(updates: Partial<WizardState>) {
    setWizardState((prev) => ({ ...prev, ...updates }))
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* Back nav */}
      <Link
        href="/decks/new"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft className="size-4" />
        New Deck
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Deck Wizard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Tell us what kind of deck you want and we&apos;ll build it for you.
        </p>
      </div>

      {/* Step indicator */}
      <StepIndicator current={step} steps={['Commander', 'Details', 'Generate']} />

      {/* Step content */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        {step === 1 && (
          <StepCommander
            state={wizardState}
            onNext={(updates) => {
              const merged = { ...updates }
              if (updates.commander && !wizardState.name) {
                merged.name = `${updates.commander.name} Deck`
              }
              handleStepUpdate(merged)
              setStep(2)
            }}
          />
        )}
        {step === 2 && (
          <StepDetails
            state={wizardState}
            onNext={(updates) => {
              handleStepUpdate(updates)
              setStep(3)
            }}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <StepGenerate
            state={wizardState}
            onBack={() => setStep(2)}
          />
        )}
      </div>
    </div>
  )
}
