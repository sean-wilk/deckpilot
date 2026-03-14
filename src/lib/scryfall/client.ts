import type { ScryfallBulkDataList } from './types'

const SCRYFALL_API = 'https://api.scryfall.com'
const USER_AGENT = 'DeckPilot/1.0'

async function scryfallFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${SCRYFALL_API}${path}`, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Scryfall API error: ${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<T>
}

export async function getBulkDataList(): Promise<ScryfallBulkDataList> {
  return scryfallFetch<ScryfallBulkDataList>('/bulk-data')
}

export async function getOracleCardsBulkUrl(): Promise<string> {
  const list = await scryfallFetch<ScryfallBulkDataList>('/bulk-data')
  const oracleCards = list.data.find(d => d.type === 'oracle_cards')
  if (!oracleCards) {
    throw new Error('Oracle Cards bulk data not found')
  }
  return oracleCards.download_uri
}

export async function downloadBulkData(url: string): Promise<Response> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to download bulk data: ${response.status}`)
  }

  return response
}

export { scryfallFetch }
