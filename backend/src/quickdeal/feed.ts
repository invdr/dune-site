import { children, parseXml, type XmlNode } from './xml'

// Fetcher returns the raw feed body (XML text). Injectable so tests drive the
// importer with fixtures and no network.
export type FeedFetcher = (url: string) => Promise<string>

const defaultFetcher: FeedFetcher = async (url) => {
  const response = await fetch(url, { headers: { accept: 'application/xml, text/xml' } })
  if (!response.ok) {
    throw new Error(`QuickDeal feed responded with ${response.status}`)
  }
  return response.text()
}

// Parses the feed and returns one node per <estate-object>. A body that is not
// the expected <estate-objects> document yields an empty list, which the
// importer treats as a suspicious empty feed (keeps the last known catalog
// rather than mass-archiving).
export async function fetchFeed(url: string, fetcher: FeedFetcher = defaultFetcher): Promise<XmlNode[]> {
  const body = await fetcher(url)
  const root = parseXml(body)
  const container = root.children.find((node) => node.tag === 'estate-objects') ?? root
  return children(container, 'estate-object')
}
