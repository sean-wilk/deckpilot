export interface ParsedCard {
  quantity: number
  name: string
  setCode?: string
  collectorNumber?: string
  isCommander?: boolean
  isSideboard?: boolean
}

export interface ParseResult {
  cards: ParsedCard[]
  errors: string[]
}

export function parseTextList(text: string): ParseResult {
  const lines = text.trim().split('\n')
  const cards: ParsedCard[] = []
  const errors: string[] = []
  let isSideboard = false

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('//')) continue

    // Check for sideboard section
    if (line.toLowerCase() === 'sideboard' || line.toLowerCase() === 'sideboard:') {
      isSideboard = true
      continue
    }

    // Check for commander designation
    const isCommander = line.includes('*CMDR*') || line.toLowerCase().includes('*commander*')
    const cleanLine = line.replace(/\*CMDR\*/gi, '').replace(/\*commander\*/gi, '').trim()

    // MTGO format: "1 Card Name"
    // Arena format: "1 Card Name (SET) #123"
    const mtgoMatch = cleanLine.match(/^(\d+)\s+(.+?)(?:\s+\(([A-Z0-9]+)\)\s*(\d+)?)?$/)

    if (mtgoMatch) {
      cards.push({
        quantity: parseInt(mtgoMatch[1]),
        name: mtgoMatch[2].trim(),
        setCode: mtgoMatch[3],
        collectorNumber: mtgoMatch[4],
        isCommander,
        isSideboard,
      })
    } else {
      // Try without quantity (assume 1)
      const name = cleanLine.replace(/^\d+x?\s*/, '').trim()
      if (name) {
        cards.push({ quantity: 1, name, isCommander, isSideboard })
      } else {
        errors.push(`Could not parse line: "${rawLine}"`)
      }
    }
  }

  return { cards, errors }
}
