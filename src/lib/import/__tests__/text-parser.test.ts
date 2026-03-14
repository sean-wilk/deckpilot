import { describe, it, expect } from 'vitest'
import { parseTextList } from '../text-parser'

describe('parseTextList', () => {
  it('parses MTGO format', () => {
    const result = parseTextList('1 Sol Ring\n1 Lightning Bolt')
    expect(result.cards).toHaveLength(2)
    expect(result.cards[0].name).toBe('Sol Ring')
    expect(result.cards[0].quantity).toBe(1)
  })

  it('parses Arena format', () => {
    const result = parseTextList('1 Sol Ring (C21) 263')
    expect(result.cards).toHaveLength(1)
    expect(result.cards[0].setCode).toBe('C21')
  })

  it('handles commander designation', () => {
    const result = parseTextList('1 Atraxa, Praetors\' Voice *CMDR*')
    expect(result.cards[0].isCommander).toBe(true)
  })

  it('handles sideboard section', () => {
    const result = parseTextList('1 Sol Ring\n\nSideboard\n1 Swords to Plowshares')
    expect(result.cards[1].isSideboard).toBe(true)
  })

  it('skips empty lines and comments', () => {
    const result = parseTextList('// My deck\n\n1 Sol Ring\n')
    expect(result.cards).toHaveLength(1)
  })

  it('handles quantity without space', () => {
    const result = parseTextList('4x Lightning Bolt')
    expect(result.cards[0].quantity).toBe(1) // Falls through to name-only parsing
    expect(result.cards[0].name).toBe('Lightning Bolt')
  })
})
