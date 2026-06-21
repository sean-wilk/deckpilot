import { describe, it, expect } from 'vitest'
import { buildCardRolesMap, mergeWithManualOverrides } from '../card-categories'

describe('buildCardRolesMap', () => {
  it('builds a Record<string, string[]> from category rows', () => {
    const rows = [
      { cardName: 'Cultivate', category: 'ramp' },
      { cardName: 'Cyclonic Rift', category: 'targeted-removal' },
      { cardName: 'Cyclonic Rift', category: 'board-wipes' },
    ]
    const result = buildCardRolesMap(rows)
    expect(result).toEqual({
      'Cultivate': ['ramp'],
      'Cyclonic Rift': ['targeted-removal', 'board-wipes'],
    })
  })

  it('returns empty object for empty input', () => {
    expect(buildCardRolesMap([])).toEqual({})
  })

  it('does not duplicate categories for the same card', () => {
    const rows = [
      { cardName: 'Sol Ring', category: 'ramp' },
      { cardName: 'Sol Ring', category: 'ramp' },
    ]
    const result = buildCardRolesMap(rows)
    expect(result).toEqual({ 'Sol Ring': ['ramp'] })
  })
})

describe('mergeWithManualOverrides', () => {
  it('preserves manual overrides and replaces ai assignments', () => {
    const existing = [
      { cardName: 'Sol Ring', category: 'ramp', isManualOverride: true },
      { cardName: 'Cultivate', category: 'ramp', isManualOverride: false },
    ]
    const newAssignments = [
      { cardName: 'Sol Ring', categories: ['utility'] },
      { cardName: 'Cultivate', categories: ['ramp'] },
      { cardName: 'Forest', categories: ['lands'] },
    ]
    const result = mergeWithManualOverrides(existing, newAssignments)
    expect(result.preserved).toEqual([{ cardName: 'Sol Ring', category: 'ramp' }])
    expect(result.toInsert).toContainEqual({ cardName: 'Cultivate', category: 'ramp', source: 'ai-structure' })
    expect(result.toInsert).toContainEqual({ cardName: 'Forest', category: 'lands', source: 'ai-structure' })
    // Sol Ring's AI-suggested 'utility' should still be inserted (it doesn't conflict with manual 'ramp')
    expect(result.toInsert).toContainEqual({ cardName: 'Sol Ring', category: 'utility', source: 'ai-structure' })
  })

  it('handles empty existing and new assignments', () => {
    expect(mergeWithManualOverrides([], [])).toEqual({ preserved: [], toInsert: [] })
  })
})
