import { describe, it, expect } from 'vitest'
import { distance } from 'fastest-levenshtein'

describe('fuzzy card matching', () => {
  it('identifies close matches for typos', () => {
    const d = distance('Lightening Bolt', 'Lightning Bolt')
    expect(d).toBeLessThanOrEqual(3)
  })

  it('rejects distant matches', () => {
    const d = distance('Sol Ring', 'Rhystic Study')
    expect(d).toBeGreaterThan(3)
  })
})
