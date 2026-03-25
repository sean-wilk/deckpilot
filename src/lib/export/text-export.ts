interface ExportCard {
  quantity: number
  name: string
  setCode?: string
  isCommander?: boolean
  board?: 'main' | 'side' | 'maybe'
}

export function exportMTGO(cards: ExportCard[]): string {
  const mainboard = cards.filter(c => c.board !== 'side' && c.board !== 'maybe')
  const sideboard = cards.filter(c => c.board === 'side')
  const maybeboard = cards.filter(c => c.board === 'maybe')

  let output = mainboard
    .map(c => `${c.quantity} ${c.name}`)
    .join('\n')

  if (sideboard.length > 0) {
    output += '\n\nSideboard\n'
    output += sideboard.map(c => `${c.quantity} ${c.name}`).join('\n')
  }

  if (maybeboard.length > 0) {
    output += '\n\nMaybeboard\n'
    output += maybeboard.map(c => `${c.quantity} ${c.name}`).join('\n')
  }

  return output
}

export function exportArena(cards: ExportCard[]): string {
  const mainboard = cards.filter(c => c.board !== 'side' && c.board !== 'maybe')
  const sideboard = cards.filter(c => c.board === 'side')
  const maybeboard = cards.filter(c => c.board === 'maybe')

  let output = mainboard
    .map(c => `${c.quantity} ${c.name}${c.setCode ? ` (${c.setCode})` : ''}`)
    .join('\n')

  if (sideboard.length > 0) {
    output += '\n\nSideboard\n'
    output += sideboard.map(c => `${c.quantity} ${c.name}${c.setCode ? ` (${c.setCode})` : ''}`).join('\n')
  }

  if (maybeboard.length > 0) {
    output += '\n\nMaybeboard\n'
    output += maybeboard.map(c => `${c.quantity} ${c.name}${c.setCode ? ` (${c.setCode})` : ''}`).join('\n')
  }

  return output
}
