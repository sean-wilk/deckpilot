'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useActiveJobs } from '@/hooks/use-active-jobs'

export function GlobalJobToaster() {
  const { completions, clearCompletions } = useActiveJobs()
  const processedRef = useRef(new Set<string>())

  useEffect(() => {
    if (completions.length === 0) return

    for (const job of completions) {
      const key = `${job.deckId}:${job.analysisType}`
      if (processedRef.current.has(key)) continue
      processedRef.current.add(key)

      const label = job.analysisType === 'full' ? 'Analysis' : 'Recommendations'

      if (job.finalStatus === 'complete') {
        toast.success(`${label} complete for ${job.deckName}`, {
          description: 'Click to view results',
          action: {
            label: 'View',
            onClick: () => {
              window.location.href = `/decks/${job.deckId}`
            },
          },
        })
      } else {
        toast.error(`${label} failed for ${job.deckName}`, {
          description: job.errorMessage ?? 'An error occurred',
        })
      }
    }

    // Clear after processing
    clearCompletions()
  }, [completions, clearCompletions])

  return null
}
