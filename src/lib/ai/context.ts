import { db } from '@/lib/db'
import { deckCards, cards, edhrecCommanders, decks } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function buildDeckContext(deckId: string) {
  const deck = await db
    .select()
    .from(decks)
    .where(eq(decks.id, deckId))
    .limit(1)
  if (!deck[0]) throw new Error('Deck not found')

  const cardsInDeck = await db
    .select({
      name: cards.name,
      manaCost: cards.manaCost,
      cmc: cards.cmc,
      typeLine: cards.typeLine,
      oracleText: cards.oracleText,
      colorIdentity: cards.colorIdentity,
      keywords: cards.keywords,
      rarity: cards.rarity,
      cardType: deckCards.cardType,
      functionalRole: deckCards.functionalRole,
      isCommander: deckCards.isCommander,
      userNote: deckCards.userNote,
    })
    .from(deckCards)
    .innerJoin(cards, eq(deckCards.cardId, cards.id))
    .where(eq(deckCards.deckId, deckId))

  // Get commander data
  const commander = await db
    .select()
    .from(cards)
    .where(eq(cards.id, deck[0].commanderId))
    .limit(1)

  // Get EDHREC synergy data if available
  let edhrecData: string | null = null
  if (commander[0]) {
    const edhrec = await db
      .select()
      .from(edhrecCommanders)
      .where(eq(edhrecCommanders.cardId, commander[0].id))
      .limit(1)
    if (edhrec[0]) edhrecData = JSON.stringify(edhrec[0].synergyData)
  }

  // Build compact card list (token-efficient)
  const cardList = cardsInDeck
    .map((c) => {
      let entry = `${c.name} | ${c.manaCost ?? 'no cost'} | ${c.typeLine}`
      if (c.keywords?.length) entry += ` | ${c.keywords.join(', ')}`
      if (c.functionalRole) entry += ` [${c.functionalRole}]`
      if (c.userNote) entry += ` (Note: ${c.userNote})`
      return entry
    })
    .join('\n')

  return {
    deckName: deck[0].name,
    commander: commander[0]?.name ?? 'Unknown',
    partner: deck[0].partnerId ? 'Has partner' : null,
    targetBracket: deck[0].targetBracket,
    budgetLimitCents: deck[0].budgetLimitCents,
    cardCount: cardsInDeck.length,
    cardList,
    edhrecData: edhrecData ? edhrecData.slice(0, 3000) : null,
  }
}
