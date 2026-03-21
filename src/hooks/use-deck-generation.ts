'use client'

import { useState, useRef, useCallback } from 'react'

export interface StreamedCard {
  index: number
  name: string
  category: string
  reasoning: string
  phase?: number
  validated?: boolean
  validationReason?: string | null
  cardId?: string | null
}

export interface ValidationSummary {
  valid: number
  invalid: number
}

export interface QualityReport {
  originalInvalid: number
  fixed: number
  dropped: number
  totalCards: number
}

export interface BracketReasoning {
  bracket: number
  reasoning: string
}

interface GenerationPlan {
  planned_lands: number
  categories: Array<{ name: string; count: number; description: string }>
  reasoning: string
}

interface CategoryProgress {
  name: string
  current: number
  total: number
}

export interface GenerateParams {
  commanderId: string
  description: string
  targetBracket: number
  budgetLimitCents?: number
  spiciness?: number
  generationMode?: 'fast' | 'standard' | 'precision'
}

interface UseDeckGenerationReturn {
  cards: StreamedCard[]
  bracketReasoning: BracketReasoning | null
  strategySummary: string
  isGenerating: boolean
  error: string | null
  totalCards: number
  phase: number
  phaseMax: { nonLands: number; lands: number }
  validationSummary: ValidationSummary | null
  currentPhase: string | null
  qualityReport: QualityReport | null
  generationPlan: GenerationPlan | null
  currentCategory: CategoryProgress | null
  generate: (params: GenerateParams) => Promise<void>
  abort: () => void
}

export function useDeckGeneration(): UseDeckGenerationReturn {
  const [cards, setCards] = useState<StreamedCard[]>([])
  const [bracketReasoning, setBracketReasoning] = useState<BracketReasoning | null>(null)
  const [strategySummary, setStrategySummary] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<number>(0)
  const [phaseMax, setPhaseMax] = useState<{ nonLands: number; lands: number }>({ nonLands: 63, lands: 36 })
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(null)
  const [currentPhase, setCurrentPhase] = useState<string | null>(null)
  const [qualityReport, setQualityReport] = useState<QualityReport | null>(null)
  const [generationPlan, setGenerationPlan] = useState<GenerationPlan | null>(null)
  const [currentCategory, setCurrentCategory] = useState<CategoryProgress | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const generate = useCallback(async (params: GenerateParams) => {
    // Reset state
    setCards([])
    setBracketReasoning(null)
    setStrategySummary('')
    setError(null)
    setPhase(0)
    setPhaseMax({ nonLands: 63, lands: 36 })
    setValidationSummary(null)
    setCurrentPhase(null)
    setQualityReport(null)
    setGenerationPlan(null)
    setCurrentCategory(null)
    setIsGenerating(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const endpoint = params.generationMode === 'precision'
        ? '/api/ai/generate-deck-guided'
        : params.generationMode === 'standard'
          ? '/api/ai/generate-deck-quality'
          : '/api/ai/generate-deck-stream'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: controller.signal,
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${res.status}`)
      }

      if (!res.body) throw new Error('No response body')

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
      let sseBuffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        sseBuffer += value

        // Parse SSE events (split on double newline)
        const events = sseBuffer.split('\n\n')
        sseBuffer = events.pop() ?? '' // Keep incomplete last chunk

        for (const eventBlock of events) {
          if (!eventBlock.trim()) continue

          const lines = eventBlock.split('\n')
          let eventType = ''
          let data = ''

          for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.slice(7)
            else if (line.startsWith('data: ')) data = line.slice(6)
            // Ignore lines starting with ':' (heartbeat comments)
          }

          if (!eventType || !data) continue

          try {
            const parsed = JSON.parse(data)
            switch (eventType) {
              case 'phase_start':
                setPhase(parsed.phase)
                if (parsed.maxCards) {
                  if (parsed.phase === 1) setPhaseMax(prev => ({ ...prev, nonLands: parsed.maxCards }))
                  if (parsed.phase === 2) setPhaseMax(prev => ({ ...prev, lands: parsed.maxCards }))
                }
                break
              case 'bracket_reasoning':
                setBracketReasoning(parsed)
                break
              case 'card':
                setCards(prev => [...prev, parsed])
                break
              case 'strategy_summary':
                setStrategySummary(parsed.summary || '')
                break
              case 'validation_summary':
                setValidationSummary({ valid: parsed.valid, invalid: parsed.invalid })
                break
              case 'phase':
                if (parsed.phase === 'generating_category') {
                  setCurrentCategory({
                    name: parsed.category as string,
                    current: parsed.current as number,
                    total: parsed.total as number,
                  })
                } else {
                  setCurrentPhase(parsed.phase)
                }
                break
              case 'quality_report':
                setQualityReport({
                  originalInvalid: parsed.originalInvalid,
                  fixed: parsed.fixed,
                  dropped: parsed.dropped,
                  totalCards: parsed.totalCards,
                })
                break
              case 'generation_plan':
                setGenerationPlan(parsed as unknown as GenerationPlan)
                break
              case 'error':
                setError(parsed.message || 'Generation failed')
                break
              case 'done':
                // Generation complete
                setCurrentCategory(null)
                break
            }
          } catch {
            // Skip unparseable events
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message)
      }
    } finally {
      setIsGenerating(false)
      setCurrentCategory(null)
      abortRef.current = null
    }
  }, [])

  const abort = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return {
    cards,
    bracketReasoning,
    strategySummary,
    isGenerating,
    error,
    totalCards: cards.length,
    phase,
    phaseMax,
    validationSummary,
    currentPhase,
    qualityReport,
    generationPlan,
    currentCategory,
    generate,
    abort,
  }
}
