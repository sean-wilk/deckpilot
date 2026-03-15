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
  1: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  2: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  3: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  4: 'bg-red-500/10 text-red-500 border-red-500/20',
  5: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
}

export const BRACKET_ACCENT_COLORS: Record<number, string> = {
  1: 'border-emerald-500 bg-emerald-500/5',
  2: 'border-blue-500 bg-blue-500/5',
  3: 'border-amber-500 bg-amber-500/5',
  4: 'border-red-500 bg-red-500/5',
  5: 'border-purple-500 bg-purple-500/5',
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
