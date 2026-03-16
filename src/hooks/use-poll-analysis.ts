'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

type UsePollResult<T> = {
  data: {
    status: string
    results: T | null
    errorMessage: string | null
    history: { id: string; createdAt: string }[]
  } | null
  isPolling: boolean
  error: Error | null
  trigger: (body: Record<string, unknown>) => Promise<void>
}

const POLL_INTERVAL = 3000

export function usePollAnalysis<T>(
  deckId: string,
  analysisType: 'full' | 'swap_suggestion'
): UsePollResult<T> {
  const [data, setData] = useState<UsePollResult<T>['data']>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const endpoint = analysisType === 'full'
    ? `/api/ai/analysis/${deckId}`
    : `/api/ai/recommendations/${deckId}`

  const postEndpoint = analysisType === 'full'
    ? '/api/ai/analyze'
    : '/api/ai/recommendations'

  const poll = useCallback(async () => {
    try {
      const res = await fetch(endpoint)
      if (!res.ok) throw new Error(`Poll failed: ${res.status}`)
      const json = await res.json()
      setData(json)

      // Stop polling when complete or failed
      if (json?.status === 'complete' || json?.status === 'failed') {
        setIsPolling(false)
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    }
  }, [endpoint])

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
      await res.json()
      setData({ status: 'pending', results: null, errorMessage: null, history: [] })

      // Start polling
      intervalRef.current = setInterval(poll, POLL_INTERVAL)
    } catch (err) {
      setIsPolling(false)
      setError(err instanceof Error ? err : new Error(String(err)))
    }
  }, [postEndpoint, poll])

  // Load initial data on mount
  useEffect(() => {
    poll()
  }, [poll])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return { data, isPolling, error, trigger }
}
