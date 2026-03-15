import { db } from '@/lib/db'
import { deckCards, cards, edhrecCommanders, decks, matchHistory, matchCardPerformance } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

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

  // Get last 10 matches for this deck
  const recentMatches = await db
    .select()
    .from(matchHistory)
    .where(eq(matchHistory.deckId, deckId))
    .orderBy(desc(matchHistory.playedAt))
    .limit(10)

  // Build match summary with card performance data
  let matchSummary: string | null = null
  if (recentMatches.length > 0) {
    const matchLines: string[] = ['Match History (last 10):']

    for (const match of recentMatches) {
      // Get MVP and underperformer cards for this match
      const cardPerfs = await db
        .select({
          performance: matchCardPerformance.performance,
          note: matchCardPerformance.note,
          cardName: cards.name,
        })
        .from(matchCardPerformance)
        .innerJoin(cards, eq(matchCardPerformance.cardId, cards.id))
        .where(eq(matchCardPerformance.matchId, match.id))

      const mvpCards = cardPerfs
        .filter((p) => p.performance === 'mvp')
        .map((p) => p.cardName)
      const underperformers = cardPerfs
        .filter((p) => p.performance === 'underperformer')
        .map((p) => p.cardName)

      const opponents = match.opponentCommanders?.join(', ') ?? 'unknown'
      const turnStr = match.turnCount ? ` (Turn ${match.turnCount})` : ''
      const resultLabel = match.result === 'win' ? 'Win' : 'Loss'

      if (match.result === 'win') {
        let line = `${resultLabel} vs ${opponents}${turnStr}`
        if (mvpCards.length) line += ` - MVPs: ${mvpCards.join(', ')}`
        if (underperformers.length) line += `, Underperformers: ${underperformers.join(', ')}`
        matchLines.push(line)
      } else {
        let line = `${resultLabel} vs ${opponents}${turnStr}`
        if (mvpCards.length) line += ` - MVPs: ${mvpCards.join(', ')}`
        if (underperformers.length) line += `, Underperformers: ${underperformers.join(', ')}`
        if (match.notes) line += ` - Notes: ${match.notes}`
        matchLines.push(line)
      }
    }

    const fullSummary = matchLines.join('\n')
    // Progressive trimming: if exceeds ~4000 chars, truncate older matches
    if (fullSummary.length > 4000) {
      const header = matchLines[0]
      const trimmedLines = [header]
      let total = header.length
      for (let i = 1; i < matchLines.length; i++) {
        if (total + matchLines[i].length + 1 > 4000) break
        trimmedLines.push(matchLines[i])
        total += matchLines[i].length + 1
      }
      matchSummary = trimmedLines.join('\n')
    } else {
      matchSummary = fullSummary
    }
  }

  return {
    deckName: deck[0].name,
    commander: commander[0]?.name ?? 'Unknown',
    partner: deck[0].partnerId ? 'Has partner' : null,
    targetBracket: deck[0].targetBracket,
    budgetLimitCents: deck[0].budgetLimitCents,
    cardCount: cardsInDeck.length,
    cardList,
    edhrecData: edhrecData ? edhrecData.slice(0, 3000) : null,
    matchSummary,
    // philosophy and archetype: user-defined deck identity fields
    philosophy: deck[0].philosophy ?? null,
    archetype: deck[0].archetype ?? null,
  }
}
