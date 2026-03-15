import { describe, it, expect } from 'vitest'

// Test the color identity validation logic (pure function test)
function isColorIdentityValid(
  cardColors: string[],
  commanderColors: string[],
  typeLine: string
): boolean {
  // Lands are exempt
  if (typeLine.toLowerCase().startsWith('land') || typeLine.toLowerCase().startsWith('basic land')) {
    return true
  }
  // Colorless cards always valid
  if (cardColors.length === 0) return true
  // Check every card color is in commander's identity
  return cardColors.every(c => commanderColors.includes(c))
}

describe('color identity validation', () => {
  it('allows cards within commander identity', () => {
    expect(isColorIdentityValid(['R'], ['R', 'G'], 'Creature')).toBe(true)
  })

  it('rejects cards outside commander identity', () => {
    expect(isColorIdentityValid(['U'], ['R', 'G'], 'Instant')).toBe(false)
  })

  it('allows colorless cards', () => {
    expect(isColorIdentityValid([], ['R'], 'Artifact')).toBe(true)
  })

  it('allows lands regardless of color', () => {
    expect(isColorIdentityValid(['U', 'B'], ['R'], 'Land')).toBe(true)
  })

  it('allows cards matching exact commander identity', () => {
    expect(isColorIdentityValid(['W', 'U', 'B', 'R', 'G'], ['W', 'U', 'B', 'R', 'G'], 'Creature')).toBe(true)
  })
})
