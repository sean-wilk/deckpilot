import { inngest } from '@/lib/inngest/client'
import { db } from '@/lib/db'
import { edhrecCommanders, edhrecSaltScores, cards } from '@/lib/db/schema'
import { fetchCommanderData, fetchSaltScores, commanderSlug } from './client'
import { eq } from 'drizzle-orm'

export const syncEdhrecCommander = inngest.createFunction(
  {
    id: 'sync-edhrec-commander',
    retries: 2,
    concurrency: { limit: 1 }, // Rate limit: 1 at a time
  },
  { event: 'edhrec/commander.sync' },
  async ({ event, step }) => {
    const { cardName, cardId } = event.data as { cardName: string; cardId: string }
    const slug = commanderSlug(cardName)

    const data = await step.run('fetch-commander-data', async () => {
      return await fetchCommanderData(slug)
    })

    if (!data) {
      return { success: false, reason: 'Commander not found on EDHREC' }
    }

    await step.run('upsert-commander', async () => {
      const now = new Date()
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24h TTL

      const jsonDict = data.container.json_dict

      await db.insert(edhrecCommanders)
        .values({
          cardId,
          slug,
          synergyData: jsonDict.cardlists,
          themes: jsonDict.panels ?? null,
          avgDeckStats: null,
          numDecks: jsonDict.num_decks,
          cachedAt: now,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: edhrecCommanders.cardId,
          set: {
            synergyData: jsonDict.cardlists,
            themes: jsonDict.panels ?? null,
            numDecks: jsonDict.num_decks,
            cachedAt: now,
            expiresAt,
          },
        })
    })

    return { success: true, slug }
  }
)

export const syncEdhrecSaltScores = inngest.createFunction(
  {
    id: 'sync-edhrec-salt-scores',
    retries: 2,
  },
  { cron: '0 5 * * *' }, // Daily at 5 AM UTC
  async ({ step }) => {
    const data = await step.run('fetch-salt-data', async () => {
      return await fetchSaltScores()
    })

    if (!data) {
      return { success: false, reason: 'Salt scores unavailable (403 or not found)' }
    }

    const stats = await step.run('upsert-salt-scores', async () => {
      const saltEntries = data.container.json_dict.cardlists
        .flatMap(list => list.cardviews)

      let matched = 0
      let skipped = 0
      const now = new Date()

      for (const entry of saltEntries) {
        // Find card by name
        const card = await db.select({ id: cards.id })
          .from(cards)
          .where(eq(cards.name, entry.name))
          .limit(1)

        if (card.length === 0) {
          skipped++
          continue
        }

        await db.insert(edhrecSaltScores)
          .values({
            cardId: card[0].id,
            saltScore: String(entry.salt),
            cachedAt: now,
          })
          .onConflictDoUpdate({
            target: edhrecSaltScores.cardId,
            set: {
              saltScore: String(entry.salt),
              cachedAt: now,
            },
          })

        matched++
      }

      return { matched, skipped, total: saltEntries.length }
    })

    return stats
  }
)
