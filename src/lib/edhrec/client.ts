const EDHREC_JSON_BASE = 'https://json.edhrec.com/pages'
const MAX_REQUESTS_PER_SECOND = 1

// Simple rate limiter - ensures at least 1s between requests
let lastRequestTime = 0

async function rateLimitedFetch<T>(url: string): Promise<T> {
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime

  if (timeSinceLastRequest < 1000 / MAX_REQUESTS_PER_SECOND) {
    await new Promise(resolve =>
      setTimeout(resolve, 1000 / MAX_REQUESTS_PER_SECOND - timeSinceLastRequest)
    )
  }

  lastRequestTime = Date.now()

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    if (response.status === 403 || response.status === 404) {
      return null as T
    }
    throw new Error(`EDHREC API error: ${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<T>
}

export function commanderSlug(cardName: string): string {
  return cardName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

export async function fetchCommanderData(slug: string) {
  const data = await rateLimitedFetch<import('./types').EDHRECCommanderPage>(
    `${EDHREC_JSON_BASE}/commanders/${slug}.json`
  )
  return data
}

export async function fetchSaltScores() {
  const data = await rateLimitedFetch<import('./types').EDHRECSaltPage>(
    `${EDHREC_JSON_BASE}/salt.json`
  )
  return data
}

export async function fetchThemeData(theme: string) {
  return rateLimitedFetch<unknown>(
    `${EDHREC_JSON_BASE}/themes/${theme}.json`
  )
}
