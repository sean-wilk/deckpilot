import { inngest } from '@/lib/inngest/client'
import { db } from '@/lib/db'
import { cards } from '@/lib/db/schema'
import { getOracleCardsBulkUrl, downloadBulkData } from './client'
import type { ScryfallCard } from './types'
import { sql } from 'drizzle-orm'

export const syncScryfallCards = inngest.createFunction(
  {
    id: 'sync-scryfall-cards',
    retries: 2,
  },
  [
    { event: 'scryfall/sync.requested' },
    { cron: '0 3 * * *' }, // Daily at 3 AM UTC
  ],
  async ({ step }) => {
    // Step 1: Get the bulk data download URL
    const downloadUrl = await step.run('get-bulk-url', async () => {
      return await getOracleCardsBulkUrl()
    })

    // Step 2: Download and parse the bulk data, upserting in batches
    const stats = await step.run('download-and-upsert', async () => {
      const response = await downloadBulkData(downloadUrl)

      if (!response.body) {
        throw new Error('No response body from bulk data download')
      }

      // Use stream-json for memory-efficient parsing
      const { parser } = await import('stream-json')
      const { streamArray } = await import('stream-json/streamers/StreamArray')
      const { Readable } = await import('stream')

      const readableStream = Readable.fromWeb(response.body as unknown as Parameters<typeof Readable.fromWeb>[0])
      const jsonStream = readableStream.pipe(parser()).pipe(streamArray())

      let processed = 0
      let upserted = 0
      let batch: ScryfallCard[] = []
      const BATCH_SIZE = 500

      const processBatch = async (batchItems: ScryfallCard[]) => {
        if (batchItems.length === 0) return

        const values = batchItems.map((card: ScryfallCard) => ({
          scryfallId: card.id,
          oracleId: card.oracle_id,
          name: card.name,
          manaCost: card.mana_cost ?? null,
          cmc: String(card.cmc),
          typeLine: card.type_line,
          oracleText: card.oracle_text ?? null,
          colors: card.colors ?? [],
          colorIdentity: card.color_identity,
          power: card.power ?? null,
          toughness: card.toughness ?? null,
          keywords: card.keywords,
          legalities: card.legalities,
          rarity: card.rarity,
          setCode: card.set,
          imageUris: card.image_uris ?? null,
          cardFaces: card.card_faces ?? null,
          prices: card.prices,
          edhrecRank: card.edhrec_rank ?? null,
          syncedAt: new Date(),
        }))

        await db.insert(cards)
          .values(values)
          .onConflictDoUpdate({
            target: cards.oracleId,
            set: {
              scryfallId: sql`excluded.scryfall_id`,
              name: sql`excluded.name`,
              manaCost: sql`excluded.mana_cost`,
              cmc: sql`excluded.cmc`,
              typeLine: sql`excluded.type_line`,
              oracleText: sql`excluded.oracle_text`,
              colors: sql`excluded.colors`,
              colorIdentity: sql`excluded.color_identity`,
              power: sql`excluded.power`,
              toughness: sql`excluded.toughness`,
              keywords: sql`excluded.keywords`,
              legalities: sql`excluded.legalities`,
              rarity: sql`excluded.rarity`,
              setCode: sql`excluded.set_code`,
              imageUris: sql`excluded.image_uris`,
              cardFaces: sql`excluded.card_faces`,
              prices: sql`excluded.prices`,
              edhrecRank: sql`excluded.edhrec_rank`,
              syncedAt: sql`excluded.synced_at`,
            },
          })

        upserted += batchItems.length
      }

      return new Promise<{ processed: number; upserted: number }>((resolve, reject) => {
        jsonStream.on('data', async ({ value }: { value: ScryfallCard }) => {
          processed++
          batch.push(value)

          if (batch.length >= BATCH_SIZE) {
            jsonStream.pause()
            try {
              await processBatch(batch)
              batch = []
            } catch (err) {
              reject(err)
              return
            }
            jsonStream.resume()
          }
        })

        jsonStream.on('end', async () => {
          try {
            await processBatch(batch)
            resolve({ processed, upserted })
          } catch (err) {
            reject(err)
          }
        })

        jsonStream.on('error', reject)
      })
    })

    return stats
  }
)
