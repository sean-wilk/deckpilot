import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cards } from '@/lib/db/schema'
import { ilike, sql } from 'drizzle-orm'

function normalizeCardRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    mana_cost: row.manaCost ?? row.mana_cost ?? null,
    cmc: row.cmc,
    type_line: row.typeLine ?? row.type_line ?? '',
    oracle_text: row.oracleText ?? row.oracle_text ?? null,
    colors: row.colors ?? [],
    color_identity: row.colorIdentity ?? row.color_identity ?? [],
    image_uris: row.imageUris ?? row.image_uris ?? null,
    card_faces: row.cardFaces ?? row.card_faces ?? null,
    prices: row.prices ?? null,
    rarity: row.rarity ?? '',
    set_code: row.setCode ?? row.set_code ?? '',
    edhrec_rank: row.edhrecRank ?? row.edhrec_rank ?? null,
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')
  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 50)
  const exact = searchParams.get('exact') === 'true'

  if (!query || query.length < 2) {
    return NextResponse.json({ cards: [] })
  }

  try {
    let rawRows: unknown[]

    if (exact) {
      // Exact case-insensitive match
      rawRows = await db.select({
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
      .where(sql`LOWER(${cards.name}) = LOWER(${query})`)
      .limit(limit)
    } else {
      // Try FTS first, fall back to ilike
      try {
        const ftsResult = await db.execute(
          sql`SELECT id, name, mana_cost, cmc, type_line, oracle_text, colors, color_identity,
              image_uris, card_faces, prices, rarity, set_code, edhrec_rank
          FROM cards
          WHERE search_vector @@ websearch_to_tsquery('simple', ${query})
          ORDER BY ts_rank(search_vector, websearch_to_tsquery('simple', ${query})) DESC
          LIMIT ${limit}`
        )
        rawRows = [...ftsResult] as unknown[]
      } catch {
        // search_vector column may not exist yet, fall back to ilike
        const escapedQuery = query.replace(/%/g, '\\%').replace(/_/g, '\\_')
        rawRows = await db.select({
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
        .where(ilike(cards.name, `${escapedQuery}%`))
        .limit(limit)
      }
    }

    const normalized = rawRows.map(r => normalizeCardRow(r as Record<string, unknown>))
    return NextResponse.json({ cards: normalized })
  } catch (error) {
    console.error('Card search error:', error)
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}
