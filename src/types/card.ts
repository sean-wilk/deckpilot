export interface CardImageUris {
  small: string
  normal: string
  large: string
  png: string
  art_crop: string
  border_crop: string
}

export interface CardFace {
  name: string
  mana_cost?: string
  type_line: string
  oracle_text?: string
  image_uris?: CardImageUris
}

export interface CardData {
  id: string
  name: string
  mana_cost?: string | null
  cmc: number
  type_line: string
  oracle_text?: string | null
  colors: string[]
  color_identity: string[]
  image_uris?: CardImageUris | null
  card_faces?: CardFace[] | null
  prices?: Record<string, string | null> | null
  rarity: string
  set_code: string
}
