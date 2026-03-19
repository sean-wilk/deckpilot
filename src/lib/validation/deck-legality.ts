import { db } from '@/lib/db'
import { decks, deckCards, cards, playgroups } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export type LegalityIssue = {
  cardId: string
  cardName: string
  deckCardId: string
  type: 'color_identity' | 'banned' | 'not_legal' | 'over_limit'
  message: string
}

export async function validateDeckLegality(deckId: string): Promise<LegalityIssue[]> {
  const issues: LegalityIssue[] = []

  // 1. Fetch deck with commander
  const deck = await db.select().from(decks).where(eq(decks.id, deckId)).limit(1)
  if (!deck[0]) return issues

  // 2. Fetch commander card for color identity
  const commanderCard = await db.select().from(cards).where(eq(cards.id, deck[0].commanderId)).limit(1)
  if (!commanderCard[0]) return issues

  const commanderColorIdentity = commanderCard[0].colorIdentity

  // 3. Fetch all deck cards with card data
  const allDeckCards = await db
    .select({
      deckCardId: deckCards.id,
      cardId: deckCards.cardId,
      quantity: deckCards.quantity,
      isSideboard: deckCards.isSideboard,
      cardName: cards.name,
      colorIdentity: cards.colorIdentity,
      legalities: cards.legalities,
      typeLine: cards.typeLine,
    })
    .from(deckCards)
    .innerJoin(cards, eq(deckCards.cardId, cards.id))
    .where(eq(deckCards.deckId, deckId))

  // 4. Fetch playgroup banned cards if applicable
  let bannedCardIds: string[] = []
  if (deck[0].playgroupId) {
    const pg = await db.select({ bannedCards: playgroups.bannedCards })
      .from(playgroups)
      .where(eq(playgroups.id, deck[0].playgroupId))
      .limit(1)
    if (pg[0]) {
      bannedCardIds = pg[0].bannedCards
    }
  }

  // 5. Check each card
  let totalQuantity = 0

  for (const dc of allDeckCards) {
    if (!dc.isSideboard) {
      totalQuantity += dc.quantity
    }

    // a. Color identity check — card colors must be subset of commander's
    const isLand = dc.typeLine.toLowerCase().startsWith('land') || dc.typeLine.toLowerCase().startsWith('basic land')
    const isColorless = dc.colorIdentity.length === 0
    if (!isLand && !isColorless) {
      const isValid = dc.colorIdentity.every((c: string) => commanderColorIdentity.includes(c))
      if (!isValid) {
        issues.push({
          cardId: dc.cardId,
          cardName: dc.cardName,
          deckCardId: dc.deckCardId,
          type: 'color_identity',
          message: `${dc.cardName}'s color identity does not match commander's color identity`,
        })
      }
    }

    // b. Commander legality check
    const legalities = dc.legalities as Record<string, string> | null
    if (legalities) {
      const commanderLegality = legalities.commander
      if (commanderLegality && commanderLegality !== 'legal' && commanderLegality !== 'restricted') {
        issues.push({
          cardId: dc.cardId,
          cardName: dc.cardName,
          deckCardId: dc.deckCardId,
          type: 'not_legal',
          message: `${dc.cardName} is ${commanderLegality} in Commander`,
        })
      }
    }

    // c. Playgroup banned check
    if (bannedCardIds.includes(dc.cardId)) {
      issues.push({
        cardId: dc.cardId,
        cardName: dc.cardName,
        deckCardId: dc.deckCardId,
        type: 'banned',
        message: `${dc.cardName} is banned in this playgroup`,
      })
    }
  }

  // 6. Check total card count (commander decks should be exactly 100)
  // Add 1 for the commander itself (not in deck_cards typically)
  if (totalQuantity > 99) {
    issues.push({
      cardId: '',
      cardName: '',
      deckCardId: '',
      type: 'over_limit',
      message: `Deck has ${totalQuantity} cards in the main deck (excluding commander). Commander decks should have 99 cards plus the commander.`,
    })
  }

  return issues
}
