export function getSpicyPrompt(spiciness: number): string {
  if (spiciness <= 15) return 'Build a meta-optimal, competitive deck using the most powerful and efficient staples available.'
  if (spiciness <= 35) return 'Build a tuned deck that is strong and consistent but not necessarily top-tier competitive.'
  if (spiciness <= 65) return 'Build a balanced deck mixing strong cards with interesting and fun choices.'
  if (spiciness <= 85) return 'Build a spicy deck favoring creative, unexpected, and underplayed card choices over raw power.'
  return 'Build a jank deck prioritizing wild, weird, and hilarious card choices. Embrace chaos and fun over winning.'
}
