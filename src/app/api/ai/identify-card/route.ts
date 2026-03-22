import { NextRequest, NextResponse } from 'next/server'
import { getVisionClient } from '@/lib/ai/providers'
import { db } from '@/lib/db'
import { cards } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  // 1. Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse form data
  const formData = await request.formData()
  const imageFile = formData.get('image') as File | null
  if (!imageFile) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 })
  }

  // File size limit
  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
  if (imageFile.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'Image too large. Maximum size is 10MB.' },
      { status: 413 }
    )
  }

  // 3. Validate file type
  const validTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!validTypes.includes(imageFile.type)) {
    return NextResponse.json({ error: 'Invalid image type. Use JPEG, PNG, or WebP.' }, { status: 400 })
  }

  // 4. Convert to base64
  const buffer = await imageFile.arrayBuffer()
  const base64Data = Buffer.from(buffer).toString('base64')
  const mediaType = imageFile.type as 'image/jpeg' | 'image/png' | 'image/webp'

  // 5. Call Anthropic vision API
  try {
    const { client, model } = await getVisionClient()

    const response = await client.messages.create({
      model,
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Data,
            },
          },
          {
            type: 'text',
            text: `You are looking at a photo of a Magic: The Gathering card. Identify the exact card name as it appears on the card. Return ONLY a JSON object with this format: { "cardName": "exact card name" }. If you cannot identify the card or it's not an MTG card, return: { "cardName": null, "reason": "brief explanation" }`,
          },
        ],
      }],
    })

    // 6. Parse AI response
    const textBlock = response.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ cardName: null, cardId: null, imageUri: null, reason: 'No response from AI' }, { status: 200 })
    }

    let parsed: { cardName: string | null; reason?: string }
    try {
      // Extract JSON from response (may have markdown code blocks)
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { cardName: null, reason: 'Could not parse AI response' }
    } catch {
      parsed = { cardName: null, reason: 'Could not parse AI response' }
    }

    if (!parsed.cardName) {
      return NextResponse.json({ cardName: null, cardId: null, imageUri: null, reason: parsed.reason || 'Card not identified' }, { status: 200 })
    }

    // 7. Match against local Scryfall DB
    const dbResults = await db.select({
      id: cards.id,
      name: cards.name,
      imageUris: cards.imageUris,
      cardFaces: cards.cardFaces,
    }).from(cards)
      .where(sql`LOWER(${cards.name}) = LOWER(${parsed.cardName})`)
      .limit(1)

    const card = dbResults[0]
    type ImageUris = Record<string, string | undefined> | null
    type CardFace = { image_uris?: Record<string, string | undefined> }
    const uris = card?.imageUris as ImageUris
    const faces = card?.cardFaces as CardFace[] | null
    const imageUri = card
      ? uris?.normal ?? uris?.small ?? faces?.[0]?.image_uris?.normal ?? null
      : null

    return NextResponse.json({
      cardName: parsed.cardName,
      cardId: card?.id ?? null,
      imageUri,
      confidence: card ? 'high' : 'low',
      reason: card ? undefined : 'Card not found in database',
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Vision identification failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
