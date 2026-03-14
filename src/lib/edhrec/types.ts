export interface EDHRECCardEntry {
  name: string
  sanitized: string
  url: string
  synergy: number
  num_decks: number
  inclusion: number
  potential_decks: number
  cmc: number
  primary_type: string
  rarity: string
  type: string
  layout: string
  prices: Record<string, number | null>
  image_uris: string[]
  scryfall_uri: string
  trend_zscore?: number
}

export interface EDHRECCommanderPage {
  container: {
    json_dict: {
      card: {
        name: string
        sanitized: string
        color_identity: string[]
      }
      cardlists: Array<{
        tag: string
        cardviews: EDHRECCardEntry[]
      }>
      panels: Record<string, unknown>
      num_decks: number
    }
  }
}

export interface EDHRECSaltEntry {
  name: string
  salt: number
  url: string
}

export interface EDHRECSaltPage {
  container: {
    json_dict: {
      cardlists: Array<{
        tag: string
        cardviews: EDHRECSaltEntry[]
      }>
    }
  }
}
