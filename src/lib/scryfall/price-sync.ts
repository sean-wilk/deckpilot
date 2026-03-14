import { inngest } from '@/lib/inngest/client'
import { db } from '@/lib/db'
import { cards } from '@/lib/db/schema'
import { scryfallFetch } from './client'
import { eq } from 'drizzle-orm'
import type { ScryfallBulkDataList } from './types'

export const syncScryfallPrices = inngest.createFunction(
  {
    id: 'sync-scryfall-prices',
    retries: 2,
  },
  { cron: '0 4 * * *' }, // Daily at 4 AM UTC (1hr after card sync)
  async ({ step }) => {
    // Step 1: Get the default cards bulk data URL (has prices per printing)
    const downloadUrl = await step.run('get-price-bulk-url', async () => {
      const list = await scryfallFetch<ScryfallBulkDataList>('/bulk-data')
      const defaultCards = list.data.find(d => d.type === 'default_cards')
      if (!defaultCards) {
        throw new Error('Default Cards bulk data not found')
      }
      return defaultCards.download_uri
    })

    // Step 2: Download and stream-parse, updating prices
    const stats = await step.run('update-prices', async () => {
      const response = await fetch(downloadUrl, {
        headers: { 'User-Agent': 'DeckPilot/1.0' },
      })

      if (!response.ok || !response.body) {
        throw new Error(`Failed to download price data: ${response.status}`)
      }

      const { parser } = await import('stream-json')
      const { streamArray } = await import('stream-json/streamers/StreamArray')
      const { Readable } = await import('stream')

      const readableStream = Readable.fromWeb(response.body as any)
      const jsonStream = readableStream.pipe(parser()).pipe(streamArray())

      // Collect cheapest price per oracle_id
      const priceMap = new Map<string, Record<string, string | null>>()
      let processed = 0

      return new Promise<{ processed: number; updated: number }>((resolve, reject) => {
        jsonStream.on('data', ({ value }: { value: any }) => {
          processed++
          const oracleId = value.oracle_id
          if (!oracleId || !value.prices) return

          const existing = priceMap.get(oracleId)
          if (!existing) {
            priceMap.set(oracleId, value.prices)
          } else {
            // Keep cheapest USD price
            const currentUsd = parseFloat(existing.usd ?? '999999')
            const newUsd = parseFloat(value.prices.usd ?? '999999')
            if (newUsd < currentUsd) {
              priceMap.set(oracleId, value.prices)
            }
          }
        })

        jsonStream.on('end', async () => {
          try {
            // Batch update prices
            let updated = 0
            const entries = Array.from(priceMap.entries())
            const BATCH_SIZE = 100

            for (let i = 0; i < entries.length; i += BATCH_SIZE) {
              const batch = entries.slice(i, i + BATCH_SIZE)
              await Promise.all(
                batch.map(([oracleId, prices]) =>
                  db.update(cards)
                    .set({ prices })
                    .where(eq(cards.oracleId, oracleId))
                )
              )
              updated += batch.length
            }

            resolve({ processed, updated })
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
