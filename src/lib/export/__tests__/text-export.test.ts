import { describe, it, expect } from 'vitest'
import { exportMTGO, exportArena } from '../text-export'

describe('exportMTGO', () => {
  it('exports cards in MTGO format', () => {
    const result = exportMTGO([
      { quantity: 1, name: 'Sol Ring' },
      { quantity: 1, name: 'Lightning Bolt' },
    ])
    expect(result).toBe('1 Sol Ring\n1 Lightning Bolt')
  })

  it('separates sideboard', () => {
    const result = exportMTGO([
      { quantity: 1, name: 'Sol Ring', board: 'main' },
      { quantity: 1, name: 'Swords to Plowshares', board: 'side' },
    ])
    expect(result).toContain('Sideboard')
    expect(result).toContain('1 Swords to Plowshares')
  })

  it('separates maybeboard', () => {
    const result = exportMTGO([
      { quantity: 1, name: 'Sol Ring', board: 'main' },
      { quantity: 1, name: 'Mana Crypt', board: 'maybe' },
    ])
    expect(result).toContain('Maybeboard')
    expect(result).toContain('1 Mana Crypt')
  })
})

describe('exportArena', () => {
  it('includes set code when available', () => {
    const result = exportArena([
      { quantity: 1, name: 'Sol Ring', setCode: 'C21' },
    ])
    expect(result).toBe('1 Sol Ring (C21)')
  })
})
