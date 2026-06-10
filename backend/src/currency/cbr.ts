// Central Bank of Russia daily rates. The official endpoint returns XML with one
// <Valute> block per currency; USD is R01235. `Value` uses a comma decimal and
// is quoted per `Nominal` units (1 for USD).
const CBR_DAILY_URL = 'https://www.cbr.ru/scripts/XML_daily.asp'
const USD_VALUTE_ID = 'R01235'

export type CbrFetcher = (url: string) => Promise<string>

const defaultFetcher: CbrFetcher = async (url) => {
  const response = await fetch(url, { headers: { accept: 'application/xml' } })
  if (!response.ok) {
    throw new Error(`CBR responded with ${response.status}`)
  }
  return response.text()
}

// Parses the USD→RUB rate (roubles per one dollar) out of the CBR daily XML.
// Returns null when the USD block or its numbers cannot be found, so callers can
// fall back to the last cached value instead of throwing.
export function parseUsdRubFromCbrXml(xml: string): number | null {
  const block = new RegExp(`<Valute[^>]*ID="${USD_VALUTE_ID}"[^>]*>([\\s\\S]*?)</Valute>`).exec(xml)
  if (!block) return null

  const nominalMatch = /<Nominal>([\d\s.,]+)<\/Nominal>/.exec(block[1] ?? '')
  const valueMatch = /<Value>([\d\s.,]+)<\/Value>/.exec(block[1] ?? '')
  if (!valueMatch) return null

  const value = Number.parseFloat(valueMatch[1]!.replace(/\s/g, '').replace(',', '.'))
  const nominal = nominalMatch ? Number.parseFloat(nominalMatch[1]!.replace(/\s/g, '').replace(',', '.')) : 1

  if (!Number.isFinite(value) || !Number.isFinite(nominal) || nominal <= 0) return null
  return value / nominal
}

// Fetches today's USD→RUB rate from the CBR. Throws on network/parse failure;
// the currency service turns that into a "keep last known value" fallback.
export async function fetchCbrUsdRub(fetcher: CbrFetcher = defaultFetcher): Promise<number> {
  const xml = await fetcher(CBR_DAILY_URL)
  const rate = parseUsdRubFromCbrXml(xml)
  if (rate == null) {
    throw new Error('Could not parse USD→RUB rate from CBR response')
  }
  return rate
}
