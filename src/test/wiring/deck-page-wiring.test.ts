import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

function readSource(relativePath: string): string {
  const fullPath = join(process.cwd(), relativePath)
  if (!existsSync(fullPath)) {
    return '' // File doesn't exist yet — test will fail as expected
  }
  return readFileSync(fullPath, 'utf-8')
}

describe('Deck page wiring', () => {
  it('DeckPageSidebar renders ManaCurveChart', () => {
    const source = readSource('src/components/deck/deck-page-sidebar.tsx')
    expect(source).toContain('ManaCurveChart')
  })

  it('DeckPageSidebar renders ColorChart', () => {
    const source = readSource('src/components/deck/deck-page-sidebar.tsx')
    expect(source).toContain('ColorChart')
  })

  it('deck page imports DeckPageSidebar', () => {
    const source = readSource('src/app/(dashboard)/decks/[id]/page.tsx')
    expect(source).toContain('DeckPageSidebar')
  })

  it('deck page imports DeckPageHeader', () => {
    const source = readSource('src/app/(dashboard)/decks/[id]/page.tsx')
    expect(source).toContain('DeckPageHeader')
  })

  it('deck page header links to recommendations', () => {
    const source = readSource('src/components/deck/deck-page-header.tsx')
    expect(source).toMatch(/href.*recommendations/)
  })

  it('deck page header links to import', () => {
    const source = readSource('src/components/deck/deck-page-header.tsx')
    expect(source).toMatch(/href.*import/)
  })

  it('deck page has no Phase 6 placeholder', () => {
    const source = readSource('src/app/(dashboard)/decks/[id]/page.tsx')
    expect(source).not.toMatch(/Phase 6/i)
    expect(source).not.toMatch(/coming soon/i)
    expect(source).not.toMatch(/coming in Phase/i)
  })

  it('layout imports ThemeToggle', () => {
    const source = readSource('src/app/(dashboard)/layout.tsx')
    expect(source).toContain('ThemeToggle')
  })

  it('app metadata is not default', () => {
    const source = readSource('src/app/layout.tsx')
    expect(source).not.toContain('Create Next App')
  })
})
