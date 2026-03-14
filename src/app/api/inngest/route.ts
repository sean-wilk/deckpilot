import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { helloWorld, syncScryfallCards, syncScryfallPrices, syncEdhrecCommander, syncEdhrecSaltScores } from '@/lib/inngest/functions'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [helloWorld, syncScryfallCards, syncScryfallPrices, syncEdhrecCommander, syncEdhrecSaltScores],
})
