'use client'

import { useState, useCallback } from 'react'

interface CommanderSuggestion {
  name: string
  color_identity: string[]
  match_score: number
  play_style: string
  synergy_description: string
  why_this_commander: string
}

interface UseCommanderSuggestionsReturn {
  suggestions: CommanderSuggestion[]
  isLoading: boolean
  error: string | null
  suggest: (theme: string, description?: string) => Promise<void>
  regenerate: (options?: { preset?: string; tweak?: string }) => Promise<void>
}

export function useCommanderSuggestions(): UseCommanderSuggestionsReturn {
  const [suggestions, setSuggestions] = useState<CommanderSuggestion[]>([])
  const [previousNames, setPreviousNames] = useState<string[]>([])
  const [lastTheme, setLastTheme] = useState('')
  const [lastDescription, setLastDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const suggest = useCallback(async (theme: string, description?: string) => {
    setIsLoading(true)
    setError(null)
    setPreviousNames([])
    setLastTheme(theme)
    setLastDescription(description ?? '')

    try {
      const res = await fetch('/api/ai/suggest-commanders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme, description }),
      })
      if (!res.ok) throw new Error(`Failed: ${res.status}`)
      const data = await res.json()
      const sorted = data.suggestions.sort(
        (a: CommanderSuggestion, b: CommanderSuggestion) => b.match_score - a.match_score
      )
      setSuggestions(sorted)
      setPreviousNames(sorted.map((s: CommanderSuggestion) => s.name))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get suggestions')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const regenerate = useCallback(
    async (options?: { preset?: string; tweak?: string }) => {
      setIsLoading(true)
      setError(null)

      try {
        const res = await fetch('/api/ai/suggest-commanders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            theme: lastTheme,
            description: lastDescription,
            previousSuggestions: previousNames,
            preset: options?.preset,
            tweak: options?.tweak,
          }),
        })
        if (!res.ok) throw new Error(`Failed: ${res.status}`)
        const data = await res.json()
        const sorted = data.suggestions.sort(
          (a: CommanderSuggestion, b: CommanderSuggestion) => b.match_score - a.match_score
        )
        setSuggestions(sorted)
        // Add new names to previous list to avoid repeats on next regen
        setPreviousNames(prev => [...prev, ...sorted.map((s: CommanderSuggestion) => s.name)])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to regenerate suggestions')
      } finally {
        setIsLoading(false)
      }
    },
    [lastTheme, lastDescription, previousNames]
  )

  return { suggestions, isLoading, error, suggest, regenerate }
}
