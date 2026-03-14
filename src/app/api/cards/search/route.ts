import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cards } from '@/lib/db/schema'
import { ilike, sql } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')
  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 50)

  if (!query || query.length < 2) {
    return NextResponse.json({ cards: [] })
  }

  try {
    // Try FTS first, fall back to ilike
    let results
    try {
      results = await db.execute(
        sql`SELECT id, name, mana_cost, cmc, type_line, oracle_text, colors, color_identity,
            image_uris, card_faces, prices, rarity, set_code, edhrec_rank
        FROM cards
        WHERE search_vector @@ to_tsquery('simple', ${query.split(/\s+/).map(w => w + ':*').join(' & ')})
        ORDER BY ts_rank(search_vector, to_tsquery('simple', ${query.split(/\s+/).map(w => w + ':*').join(' & ')})) DESC
        LIMIT ${limit}`
      )
    } catch {
      // search_vector column may not exist yet, fall back to ilike
      results = await db.select({
        id: cards.id,
        name: cards.name,
        manaCost: cards.manaCost,
        cmc: cards.cmc,
        typeLine: cards.typeLine,
        oracleText: cards.oracleText,
        colors: cards.colors,
        colorIdentity: cards.colorIdentity,
        imageUris: cards.imageUris,
        cardFaces: cards.cardFaces,
        prices: cards.prices,
        rarity: cards.rarity,
        setCode: cards.setCode,
        edhrecRank: cards.edhrecRank,
      })
      .from(cards)
      .where(ilike(cards.name, `${query}%`))
      .limit(limit)
    }

    return NextResponse.json({ cards: results })
  } catch (error) {
    console.error('Card search error:', error)
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}
