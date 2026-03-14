import { describe, it, expect } from 'vitest'
import { deriveCardType } from '../card-type'

describe('deriveCardType', () => {
  it('identifies lands', () => {
    expect(deriveCardType('Basic Land — Forest')).toBe('land')
  })

  it('identifies creatures', () => {
    expect(deriveCardType('Creature — Human Warrior')).toBe('creature')
  })

  it('identifies instants', () => {
    expect(deriveCardType('Instant')).toBe('instant')
  })

  it('prioritizes land over other types', () => {
    expect(deriveCardType('Artifact Land')).toBe('land')
  })

  it('returns other for unknown types', () => {
    expect(deriveCardType('Conspiracy')).toBe('other')
  })
})
