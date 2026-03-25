interface ExportCard {
  quantity: number
  name: string
  setCode?: string
  isCommander?: boolean
  board?: 'main' | 'side' | 'maybe'
}

function buildSection(
  cards: ExportCard[],
  formatLine: (c: ExportCard) => string,
): string {
  return cards.map(formatLine).join('\n')
}

function buildExport(
  cards: ExportCard[],
  formatLine: (c: ExportCard) => string,
): string {
  const mainboard = cards.filter(c => c.board !== 'side' && c.board !== 'maybe')
  const sideboard = cards.filter(c => c.board === 'side')
  const maybeboard = cards.filter(c => c.board === 'maybe')

  let output = buildSection(mainboard, formatLine)

  if (sideboard.length > 0) {
    output += '\n\nSideboard\n' + buildSection(sideboard, formatLine)
  }

  if (maybeboard.length > 0) {
    output += '\n\nMaybeboard\n' + buildSection(maybeboard, formatLine)
  }

  return output
}

export function exportMTGO(cards: ExportCard[]): string {
  return buildExport(cards, c => `${c.quantity} ${c.name}`)
}

export function exportArena(cards: ExportCard[]): string {
  return buildExport(cards, c => `${c.quantity} ${c.name}${c.setCode ? ` (${c.setCode})` : ''}`)
}
