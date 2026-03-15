export const ARCHETYPES = [
  { value: 'voltron', label: 'Voltron', description: 'Commander-focused damage' },
  { value: 'aristocrats', label: 'Aristocrats', description: 'Sacrifice synergies' },
  { value: 'combo', label: 'Combo', description: 'Win through card combos' },
  { value: 'control', label: 'Control', description: 'Permission and answers' },
  { value: 'aggro', label: 'Aggro', description: 'Fast creature damage' },
  { value: 'midrange', label: 'Midrange', description: 'Balanced threats and answers' },
  { value: 'storm', label: 'Storm', description: 'Chain spells for big turns' },
  { value: 'tokens', label: 'Tokens', description: 'Go wide with token creatures' },
  { value: 'reanimator', label: 'Reanimator', description: 'Graveyard recursion' },
  { value: 'group_hug', label: 'Group Hug', description: 'Help everyone, win sneakily' },
  { value: 'stax', label: 'Stax', description: 'Resource denial' },
  { value: 'spellslinger', label: 'Spellslinger', description: 'Instants and sorceries matter' },
  { value: 'tribal', label: 'Tribal', description: 'Creature type synergy' },
  { value: 'superfriends', label: 'Superfriends', description: 'Planeswalker focused' },
  { value: 'landfall', label: 'Landfall', description: 'Land-drop triggers' },
  { value: 'mill', label: 'Mill', description: 'Empty opponent libraries' },
  { value: 'burn', label: 'Burn', description: 'Direct damage' },
  { value: 'enchantress', label: 'Enchantress', description: 'Enchantment synergies' },
  { value: 'equipment', label: 'Equipment', description: 'Equipment synergies' },
  { value: 'wheels', label: 'Wheels', description: 'Mass draw/discard' },
  { value: 'other', label: 'Other', description: 'Custom or mixed strategy' },
] as const

export type ArchetypeValue = (typeof ARCHETYPES)[number]['value']

export const ARCHETYPE_LABELS: Record<string, string> = Object.fromEntries(
  ARCHETYPES.map(a => [a.value, a.label])
)

export function getArchetypeLabel(archetype: string): string {
  return ARCHETYPE_LABELS[archetype] ?? archetype
}
