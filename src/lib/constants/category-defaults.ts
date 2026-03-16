// Sensible starting-point defaults used only until AI suggests deck-specific targets
export const SENSIBLE_DEFAULTS: Record<string, number> = {
  ramp: 10,
  cardDraw: 10,
  targetedRemoval: 8,
  boardWipes: 3,
  winConditions: 4,
  protection: 4,
  lands: 36,
}

export const CATEGORY_LABELS: Record<string, string> = {
  ramp: 'Ramp',
  cardDraw: 'Card Draw',
  targetedRemoval: 'Targeted Removal',
  boardWipes: 'Board Wipes',
  winConditions: 'Win Conditions',
  protection: 'Protection',
  lands: 'Lands',
}

export const CATEGORY_KEYS = Object.keys(SENSIBLE_DEFAULTS)
