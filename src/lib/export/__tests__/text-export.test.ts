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
      { quantity: 1, name: 'Sol Ring' },
      { quantity: 1, name: 'Swords to Plowshares', isSideboard: true },
    ])
    expect(result).toContain('Sideboard')
    expect(result).toContain('1 Swords to Plowshares')
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
