import { NextRequest, NextResponse } from 'next/server'
import { parseTextList } from '@/lib/import/text-parser'
import { db } from '@/lib/db'
import { cards } from '@/lib/db/schema'
import { ilike, eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()
    const { cards: parsedCards, errors } = parseTextList(text)

    const matched = []
    const unmatched = []

    for (const parsed of parsedCards) {
      // Try exact match first
      let result = await db.select().from(cards)
        .where(eq(cards.name, parsed.name)).limit(1)

      // Try case-insensitive match
      if (result.length === 0) {
        result = await db.select().from(cards)
          .where(ilike(cards.name, parsed.name)).limit(1)
      }

      // Try partial match for DFCs (e.g., "Delver of Secrets" matching "Delver of Secrets // Insectile Aberration")
      if (result.length === 0) {
        result = await db.select().from(cards)
          .where(ilike(cards.name, `${parsed.name} //%`)).limit(1)
      }

      if (result.length > 0) {
        matched.push({
          ...parsed,
          card: result[0],
        })
      } else {
        unmatched.push(parsed)
      }
    }

    return NextResponse.json({ matched, unmatched, parseErrors: errors })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
