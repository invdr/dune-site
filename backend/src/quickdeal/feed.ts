import type { QuickDealFeedObject } from './mapper'

export type FeedFetcher = (url: string) => Promise<unknown>

const defaultFetcher: FeedFetcher = async (url) => {
  const response = await fetch(url, { headers: { accept: 'application/json' } })
  if (!response.ok) {
    throw new Error(`QuickDeal feed responded with ${response.status}`)
  }
  return response.json()
}

// The native feed may return a bare array or wrap the objects under a common
// key. Normalize both into an object array.
function extractObjects(payload: unknown): QuickDealFeedObject[] {
  if (Array.isArray(payload)) return payload as QuickDealFeedObject[]
  if (payload && typeof payload === 'object') {
    for (const key of ['objects', 'items', 'data', 'result']) {
      const value = (payload as Record<string, unknown>)[key]
      if (Array.isArray(value)) return value as QuickDealFeedObject[]
    }
  }
  return []
}

export async function fetchFeed(url: string, fetcher: FeedFetcher = defaultFetcher): Promise<QuickDealFeedObject[]> {
  return extractObjects(await fetcher(url))
}
