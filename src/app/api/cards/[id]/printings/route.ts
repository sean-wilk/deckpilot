import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cards } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const revalidate = 86400

interface ScryfallCard {
  id: string
  name: string
  set: string
  set_name: string
  image_uris?: Record<string, string>
  card_faces?: Array<{ image_uris?: Record<string, string> }>
  prices: Record<string, string | null>
  released_at: string
}

interface ScryfallSearchResponse {
  data: ScryfallCard[]
  has_more: boolean
  next_page?: string
}

interface PrintingResult {
  scryfallId: string
  name: string
  setCode: string
  setName: string
  imageUris: Record<string, string> | null
  prices: Record<string, string | null>
  releasedAt: string
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Look up card in DB to get oracleId
  const [card] = await db
    .select({ oracleId: cards.oracleId })
    .from(cards)
    .where(eq(cards.id, id))
    .limit(1)

  if (!card) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 })
  }

  if (!card.oracleId) {
    return NextResponse.json({ error: 'Card has no oracle ID' }, { status: 404 })
  }

  const { oracleId } = card

  // Fetch all printings from Scryfall
  const scryfallUrl = `https://api.scryfall.com/cards/search?order=released&q=oracleid:${oracleId}&unique=prints`

  let scryfallResponse: Response
  try {
    scryfallResponse = await fetch(scryfallUrl, {
      headers: {
        'User-Agent': 'DeckPilot/1.0',
      },
    })
  } catch (error) {
    console.error('Scryfall fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to reach Scryfall API' },
      { status: 502 }
    )
  }

  if (!scryfallResponse.ok) {
    const errorText = await scryfallResponse.text().catch(() => 'Unknown error')
    return NextResponse.json(
      { error: `Scryfall API error: ${errorText}` },
      { status: 502 }
    )
  }

  const scryfallData: ScryfallSearchResponse = await scryfallResponse.json()

  const printings: PrintingResult[] = scryfallData.data.map((card) => ({
    scryfallId: card.id,
    name: card.name,
    setCode: card.set,
    setName: card.set_name,
    imageUris: card.image_uris ?? card.card_faces?.[0]?.image_uris ?? null,
    prices: card.prices,
    releasedAt: card.released_at,
  }))

  return NextResponse.json(printings)
}
