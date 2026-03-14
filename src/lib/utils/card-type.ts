export function deriveCardType(typeLine: string): string {
  const lower = typeLine.toLowerCase()
  if (lower.includes('land')) return 'land'
  if (lower.includes('creature')) return 'creature'
  if (lower.includes('instant')) return 'instant'
  if (lower.includes('sorcery')) return 'sorcery'
  if (lower.includes('artifact')) return 'artifact'
  if (lower.includes('enchantment')) return 'enchantment'
  if (lower.includes('planeswalker')) return 'planeswalker'
  if (lower.includes('battle')) return 'battle'
  return 'other'
}
