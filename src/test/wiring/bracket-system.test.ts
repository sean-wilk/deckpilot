import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

function readSource(relativePath: string): string {
  const fullPath = join(process.cwd(), relativePath)
  if (!existsSync(fullPath)) return ''
  return readFileSync(fullPath, 'utf-8')
}

describe('Bracket system (1-5)', () => {
  it('shared constants file exports GAME_CHANGERS', () => {
    const source = readSource('src/lib/constants/brackets.ts')
    expect(source).toContain('GAME_CHANGERS')
    expect(source).toContain('Exhibition')
    expect(source).toContain('cEDH')
  })

  it('stats-bar imports from shared constants', () => {
    const source = readSource('src/components/deck/stats-bar.tsx')
    expect(source).toMatch(/from.*constants\/brackets/)
    expect(source).not.toMatch(/BRACKET_LABELS\s*=\s*\{/)
  })

  it('deck-page-header imports from shared constants', () => {
    const source = readSource('src/components/deck/deck-page-header.tsx')
    expect(source).toMatch(/from.*constants\/brackets/)
    expect(source).not.toMatch(/BRACKET_LABELS\s*=\s*\{/)
  })

  it('decks list page imports from shared constants', () => {
    const source = readSource('src/app/(dashboard)/decks/page.tsx')
    expect(source).toMatch(/from.*constants\/brackets/)
    expect(source).not.toMatch(/BRACKET_LABELS\s*=\s*\{/)
  })

  it('wizard page imports from shared constants', () => {
    const source = readSource('src/app/(dashboard)/decks/new/wizard/page.tsx')
    expect(source).toMatch(/from.*constants\/brackets/)
    expect(source).not.toMatch(/BRACKETS\s*=\s*\[/)
  })

  it('AI prompts reference Exhibition and Game Changers', () => {
    const source = readSource('src/lib/ai/prompts.ts')
    expect(source).toContain('Exhibition')
    expect(source).toMatch(/Game Changers|GAME_CHANGERS/)
  })

  it('recommendations prompt imports from shared constants', () => {
    const source = readSource('src/lib/ai/prompts-recommendations.ts')
    expect(source).toMatch(/from.*constants\/brackets/)
    expect(source).toContain('getBracketLabel')
  })

  it('no file has local BRACKET_LABELS definition', () => {
    const files = [
      'src/components/deck/stats-bar.tsx',
      'src/components/deck/deck-page-header.tsx',
      'src/app/(dashboard)/decks/page.tsx',
    ]
    for (const file of files) {
      const source = readSource(file)
      expect(source).not.toMatch(/BRACKET_LABELS\s*=\s*\{/)
    }
  })
})
