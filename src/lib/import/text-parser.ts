export interface ParsedCard {
  quantity: number
  name: string
  setCode?: string
  collectorNumber?: string
  isCommander?: boolean
  isSideboard?: boolean
  board?: 'main' | 'side' | 'maybe'
}

export interface ParseResult {
  cards: ParsedCard[]
  errors: string[]
}

export function parseTextList(text: string): ParseResult {
  const lines = text.trim().split('\n')
  const cards: ParsedCard[] = []
  const errors: string[] = []
  let currentBoard: 'main' | 'side' | 'maybe' = 'main'

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('//')) continue

    // Check for sideboard section
    if (line.toLowerCase() === 'sideboard' || line.toLowerCase() === 'sideboard:') {
      currentBoard = 'side'
      continue
    }

    // Check for maybeboard section
    if (line.toLowerCase() === 'maybeboard' || line.toLowerCase() === 'maybeboard:') {
      currentBoard = 'maybe'
      continue
    }

    // Check for commander designation
    const isCommander = line.includes('*CMDR*') || line.toLowerCase().includes('*commander*')
    const cleanLine = line.replace(/\*CMDR\*/gi, '').replace(/\*commander\*/gi, '').trim()

    // MTGO format: "1 Card Name"
    // Arena format: "1 Card Name (SET) #123"
    // Also handles: "4x Card Name" and "4X Card Name"
    const mtgoMatch = cleanLine.match(/^(\d+)[xX]?\s+(.+?)(?:\s+\(([A-Z0-9]+)\)\s*(\d+)?)?$/)

    if (mtgoMatch) {
      cards.push({
        quantity: parseInt(mtgoMatch[1]),
        name: mtgoMatch[2].trim(),
        setCode: mtgoMatch[3],
        collectorNumber: mtgoMatch[4],
        isCommander,
        isSideboard: currentBoard === 'side',
        board: currentBoard,
      })
    } else {
      // Try without quantity (assume 1)
      const fallbackMatch = cleanLine.match(/^(\d+)[xX]?\s+(.+)$/)
      if (fallbackMatch) {
        cards.push({ quantity: parseInt(fallbackMatch[1], 10), name: fallbackMatch[2].trim(), isCommander, isSideboard: currentBoard === 'side', board: currentBoard })
      } else {
        const name = cleanLine.replace(/^\d+[xX]?\s*/, '').trim()
        if (name) {
          cards.push({ quantity: 1, name, isCommander, isSideboard: currentBoard === 'side', board: currentBoard })
        } else {
          errors.push(`Could not parse line: "${rawLine}"`)
        }
      }
    }
  }

  return { cards, errors }
}
