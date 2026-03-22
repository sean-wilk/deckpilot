import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { helloWorld, syncScryfallCards, syncScryfallPrices, syncEdhrecCommander, syncEdhrecSaltScores, analyzeDeck, recommendCards, manaFixingAnalysis } from '@/lib/inngest/functions'

// AI analysis/recommendation steps can take several minutes
export const maxDuration = 600

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [helloWorld, syncScryfallCards, syncScryfallPrices, syncEdhrecCommander, syncEdhrecSaltScores, analyzeDeck, recommendCards, manaFixingAnalysis],
})
