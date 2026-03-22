import { db } from '@/lib/db'
import { cards } from '@/lib/db/schema'
import { eq, ilike } from 'drizzle-orm'

export async function findCardByOracleId(oracleId: string) {
  const result = await db.select().from(cards).where(eq(cards.oracleId, oracleId)).limit(1)
  return result[0] ?? null
}

export async function findCardByName(name: string) {
  const result = await db.select().from(cards).where(eq(cards.name, name)).limit(1)
  return result[0] ?? null
}

export async function searchCards(query: string, limit = 20) {
  const escaped = query.replace(/%/g, '\\%').replace(/_/g, '\\_')
  return db.select().from(cards).where(ilike(cards.name, `${escaped}%`)).limit(limit)
}
