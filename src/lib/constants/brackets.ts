export type BracketValue = 1 | 2 | 3 | 4 | 5

export const BRACKET_COUNT = 5

export const BRACKETS = [
  { value: 1 as const, label: 'Exhibition', sublabel: 'B1', description: 'Casual, no intent to win' },
  { value: 2 as const, label: 'Core', sublabel: 'B2', description: 'Upgraded precons, broad strategies' },
  { value: 3 as const, label: 'Upgraded', sublabel: 'B3', description: 'Tuned synergy, efficient combos' },
  { value: 4 as const, label: 'Optimized', sublabel: 'B4', description: 'High-power, fast wins, stax' },
  { value: 5 as const, label: 'cEDH', sublabel: 'B5', description: 'Competitive, no holds barred' },
] as const

export const BRACKET_LABELS: Record<number, string> = {
  1: 'Exhibition',
  2: 'Core',
  3: 'Upgraded',
  4: 'Optimized',
  5: 'cEDH',
}

export const BRACKET_BADGE_COLORS: Record<number, string> = {
  1: 'bg-bracket-1/10 text-bracket-1 border-bracket-1/20',
  2: 'bg-bracket-2/10 text-bracket-2 border-bracket-2/20',
  3: 'bg-bracket-3/10 text-bracket-3 border-bracket-3/20',
  4: 'bg-bracket-4/10 text-bracket-4 border-bracket-4/20',
  5: 'bg-bracket-5/10 text-bracket-5 border-bracket-5/20',
}

export const BRACKET_ACCENT_COLORS: Record<number, string> = {
  1: 'border-bracket-1 bg-bracket-1/5',
  2: 'border-bracket-2 bg-bracket-2/5',
  3: 'border-bracket-3 bg-bracket-3/5',
  4: 'border-bracket-4 bg-bracket-4/5',
  5: 'border-bracket-5 bg-bracket-5/5',
}

export function getBracketLabel(bracket: number): string {
  return BRACKET_LABELS[bracket] ?? `Bracket ${bracket}`
}

export function getBracketDescription(bracket: number): string {
  const b = BRACKETS.find(b => b.value === bracket)
  return b?.description ?? ''
}

// Official Game Changers list - cards restricted to Bracket 4+ decks
// Source: https://magic.wizards.com/en/news/announcements/introducing-commander-brackets-beta
export const GAME_CHANGERS: string[] = [
  // White
  'Drannith Magistrate',
  'Enlightened Tutor',
  "Serra's Sanctum",
  'Smothering Tithe',
  'Trouble in Pairs',
  // Blue
  'Cyclonic Rift',
  'Expropriate',
  'Force of Will',
  'Fierce Guardianship',
  'Rhystic Study',
  "Thassa's Oracle",
  'Urza, Lord High Artificer',
  'Mystical Tutor',
  'Jin-Gitaxias, Core Augur',
  // Black
  "Bolas's Citadel",
  'Demonic Tutor',
  'Imperial Seal',
  'Opposition Agent',
  'Tergrid, God of Fright',
  'Vampiric Tutor',
  'Ad Nauseam',
  // Red
  "Jeska's Will",
  'Underworld Breach',
  // Green
  'Survival of the Fittest',
  'Vorinclex, Voice of Hunger',
  "Gaea's Cradle",
  // Multicolor
  'Kinnan, Bonder Prodigy',
  'Yuriko, the Tiger\'s Shadow',
  'Winota, Joiner of Forces',
  'Grand Arbiter Augustin IV',
  // Colorless
  'Ancient Tomb',
  'Chrome Mox',
  'The One Ring',
  'The Tabernacle at Pendrell Vale',
  'Trinisphere',
  'Grim Monolith',
  "Lion's Eye Diamond",
  'Mox Diamond',
  'Mana Vault',
  'Glacial Chasm',
]
