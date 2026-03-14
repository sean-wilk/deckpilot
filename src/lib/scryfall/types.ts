export interface ScryfallBulkDataInfo {
  id: string
  type: string
  updated_at: string
  uri: string
  name: string
  description: string
  size: number
  download_uri: string
  content_type: string
  content_encoding: string
}

export interface ScryfallBulkDataList {
  object: 'list'
  has_more: boolean
  data: ScryfallBulkDataInfo[]
}

export interface ScryfallImageUris {
  small: string
  normal: string
  large: string
  png: string
  art_crop: string
  border_crop: string
}

export interface ScryfallCardFace {
  object: 'card_face'
  name: string
  mana_cost: string
  type_line: string
  oracle_text?: string
  colors?: string[]
  power?: string
  toughness?: string
  image_uris?: ScryfallImageUris
}

export interface ScryfallPrices {
  usd?: string | null
  usd_foil?: string | null
  usd_etched?: string | null
  eur?: string | null
  eur_foil?: string | null
  tix?: string | null
}

export interface ScryfallCard {
  id: string
  oracle_id: string
  name: string
  lang: string
  layout: string
  mana_cost?: string
  cmc: number
  type_line: string
  oracle_text?: string
  colors?: string[]
  color_identity: string[]
  power?: string
  toughness?: string
  keywords: string[]
  legalities: Record<string, string>
  rarity: string
  set: string
  set_name: string
  image_uris?: ScryfallImageUris
  card_faces?: ScryfallCardFace[]
  prices: ScryfallPrices
  edhrec_rank?: number
}
