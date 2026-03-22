'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

type ProgressInfo = {
  currentStep: number
  totalSteps: number
  stepLabel: string
  startedAt: string
  updatedAt: string
} | null

type UsePollResult<T> = {
  data: {
    status: string
    results: T | null
    errorMessage: string | null
    progress: ProgressInfo
    isPartial: boolean
    history: { id: string; createdAt: string; results?: T | null }[]
  } | null
  isPolling: boolean
  error: Error | null
  trigger: (body: Record<string, unknown>) => Promise<void>
  cancel: () => Promise<void>
}

const POLL_INTERVAL = 3000
const POLL_TIMEOUT = 10 * 60 * 1000 // 10 minutes

export function usePollAnalysis<T>(
  deckId: string,
  analysisType: 'full' | 'swap_suggestion'
): UsePollResult<T> {
  const [data, setData] = useState<UsePollResult<T>['data']>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const endpoint = analysisType === 'full'
    ? `/api/ai/analysis/${deckId}`
    : `/api/ai/recommendations/${deckId}`

  const postEndpoint = analysisType === 'full'
    ? '/api/ai/analyze'
    : '/api/ai/recommendations'

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsPolling(false)
  }, [])

  const poll = useCallback(async () => {
    try {
      const res = await fetch(endpoint)
      if (!res.ok) throw new Error(`Poll failed: ${res.status}`)
      const json = await res.json()
      setData(json)

      // Stop polling when complete or failed
      if (json?.status === 'complete' || json?.status === 'failed') {
        stopPolling()
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    }
  }, [endpoint, stopPolling])

  const trigger = useCallback(async (body: Record<string, unknown>) => {
    setError(null)
    setIsPolling(true)

    try {
      const res = await fetch(postEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Trigger failed: ${res.status} ${text}`)
      }
      setData({
        status: 'pending',
        results: null,
        errorMessage: null,
        progress: {
          currentStep: 1,
          totalSteps: 5,
          stepLabel: analysisType === 'full' ? 'Starting analysis...' : 'Starting recommendations...',
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        isPartial: false,
        history: [],
      })

      // Immediate first poll to catch fast-completing steps
      setTimeout(poll, 500)
      // Start polling
      intervalRef.current = setInterval(poll, POLL_INTERVAL)

      // Add timeout to stop polling after 10 minutes
      timeoutRef.current = setTimeout(() => {
        stopPolling()
        setError(new Error('Analysis timed out after 10 minutes. Please try again.'))
      }, POLL_TIMEOUT)
    } catch (err) {
      setIsPolling(false)
      setError(err instanceof Error ? err : new Error(String(err)))
    }
  }, [postEndpoint, poll, stopPolling, analysisType])

  const cancel = useCallback(async () => {
    stopPolling()
    try {
      await fetch('/api/ai/cancel-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deckId, analysisType }),
      })
      // Re-fetch current state
      await poll()
    } catch {
      // Even if cancel API fails, we've stopped polling
    }
  }, [deckId, analysisType, stopPolling, poll])

  // Load initial data on mount
  useEffect(() => {
    poll()
  }, [poll])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return { data, isPolling, error, trigger, cancel }
}
