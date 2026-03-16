import { inngest } from './client'
export { syncScryfallCards } from '@/lib/scryfall/sync'
export { syncScryfallPrices } from '@/lib/scryfall/price-sync'
export { syncEdhrecCommander, syncEdhrecSaltScores } from '@/lib/edhrec/sync'
export { analyzeDeck } from './ai-analyze'
export { recommendCards } from './ai-recommendations'
export { manaFixingAnalysis } from './ai-mana-fixing'

export const helloWorld = inngest.createFunction(
  { id: 'hello-world' },
  { event: 'test/hello.world' },
  async ({ event, step }) => {
    await step.sleep('wait-a-moment', '1s')
    return { message: `Hello ${event.data.email}!` }
  },
)
