const BASIC_LANDS: Record<string, string> = {
  W: 'Plains', U: 'Island', B: 'Swamp', R: 'Mountain', G: 'Forest',
}

export function calculateBasicLandDistribution(params: {
  colorPips: Record<string, number>
  targetLandCount: number
  existingNonBasicLands: number
  commanderColorIdentity: string[]
}): Record<string, number> {
  const { colorPips, targetLandCount, existingNonBasicLands, commanderColorIdentity } = params
  const basicsNeeded = Math.max(0, targetLandCount - existingNonBasicLands)
  if (basicsNeeded === 0) return {}

  // Filter to commander's colors only
  const relevantColors = commanderColorIdentity.filter(c => BASIC_LANDS[c])
  if (relevantColors.length === 0) return { Wastes: basicsNeeded }

  // Calculate pip ratios
  const totalPips = relevantColors.reduce((sum, c) => sum + (colorPips[c] ?? 0), 0)
  if (totalPips === 0) {
    // Even distribution
    const each = Math.floor(basicsNeeded / relevantColors.length)
    const remainder = basicsNeeded - each * relevantColors.length
    const result: Record<string, number> = {}
    relevantColors.forEach((c, i) => {
      result[BASIC_LANDS[c]] = each + (i < remainder ? 1 : 0)
    })
    return result
  }

  // Proportional distribution
  const result: Record<string, number> = {}
  let assigned = 0
  relevantColors.forEach((c, i) => {
    const ratio = (colorPips[c] ?? 0) / totalPips
    const count = i === relevantColors.length - 1
      ? basicsNeeded - assigned // Last color gets remainder
      : Math.max(1, Math.round(ratio * basicsNeeded))
    result[BASIC_LANDS[c]] = count
    assigned += count
  })

  return result
}
