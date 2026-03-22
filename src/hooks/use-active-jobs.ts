'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

type ProgressInfo = {
  currentStep: number
  totalSteps: number
  stepLabel: string
} | null

export type ActiveJob = {
  deckId: string
  deckName: string
  analysisType: string
  status: string
  progress: ProgressInfo
}

export type JobCompletion = {
  deckId: string
  deckName: string
  analysisType: string
  finalStatus: 'complete' | 'failed'
  errorMessage: string | null
}

const FAST_INTERVAL = 5000
const SLOW_INTERVAL = 30000

export function useActiveJobs() {
  const [jobs, setJobs] = useState<ActiveJob[]>([])
  const [completions, setCompletions] = useState<JobCompletion[]>([])
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleCountRef = useRef(0)
  const mountedRef = useRef(true)

  const clearCompletions = useCallback(() => {
    setCompletions([])
  }, [])

  useEffect(() => {
    mountedRef.current = true
    let nextTimeout: ReturnType<typeof setTimeout> | null = null

    async function doPoll() {
      if (!mountedRef.current) return
      try {
        const res = await fetch('/api/ai/active-jobs')
        if (!res.ok || !mountedRef.current) return
        const json = await res.json()

        const activeJobs: ActiveJob[] = json.jobs ?? []
        setJobs(activeJobs)

        const recent: JobCompletion[] = json.recentlyCompleted ?? []
        if (recent.length > 0) {
          setCompletions((prev) => {
            const existing = new Set(prev.map((c) => `${c.deckId}:${c.analysisType}`))
            const newOnes = recent.filter((c) => !existing.has(`${c.deckId}:${c.analysisType}`))
            return newOnes.length > 0 ? [...prev, ...newOnes] : prev
          })
        }

        const hasActive = activeJobs.length > 0
        if (hasActive) {
          idleCountRef.current = 0
        } else {
          idleCountRef.current++
        }

        if (idleCountRef.current >= 2 && recent.length === 0) {
          return
        }

        if (mountedRef.current) {
          nextTimeout = setTimeout(doPoll, hasActive ? FAST_INTERVAL : SLOW_INTERVAL)
          timeoutRef.current = nextTimeout
        }
      } catch {
        if (mountedRef.current) {
          nextTimeout = setTimeout(doPoll, SLOW_INTERVAL)
          timeoutRef.current = nextTimeout
        }
      }
    }

    doPoll()

    return () => {
      mountedRef.current = false
      if (nextTimeout) clearTimeout(nextTimeout)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return { jobs, completions, clearCompletions }
}
