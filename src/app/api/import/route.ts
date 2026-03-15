import { NextRequest, NextResponse } from 'next/server'
import { parseTextList } from '@/lib/import/text-parser'
import { db } from '@/lib/db'
import { cards } from '@/lib/db/schema'
import { ilike, eq, sql } from 'drizzle-orm'
import { distance } from 'fastest-levenshtein'

const FUZZY_DISTANCE_THRESHOLD = 3

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()
    const { cards: parsedCards, errors } = parseTextList(text)

    const matched = []
    const unmatched = []
    const suggestions = []

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
        // Fuzzy match: query cards with the same first letter to limit scope
        const firstLetter = parsed.name.charAt(0)
        const candidates = await db
          .selectDistinct({ name: cards.name })
          .from(cards)
          .where(sql`lower(left(${cards.name}, 1)) = lower(${firstLetter})`)

        const closeMatches = candidates
          .map(({ name }) => ({ name, distance: distance(parsed.name, name) }))
          .filter(({ distance: d }) => d <= FUZZY_DISTANCE_THRESHOLD)
          .sort((a, b) => a.distance - b.distance)

        if (closeMatches.length > 0) {
          suggestions.push({ original: parsed.name, candidates: closeMatches })
        }

        unmatched.push(parsed)
      }
    }

    return NextResponse.json({ matched, unmatched, suggestions, parseErrors: errors })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
