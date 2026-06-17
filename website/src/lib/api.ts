import type {
  ComplexDetailDto,
  ComplexDto,
  ComplexFacetsResponse,
  ComplexListResponse,
  CreateLeadRequest,
  HomeContentDto,
  LeadDto,
  PropertyCitiesResponse,
  PropertyCityFacet,
  PropertyDto,
  PropertyListResponse,
  PublicSiteSettingsDto,
  ResolvedContactDto,
} from '@dune/contracts'

// Backend base URL. PUBLIC_ so it is inlined for client islands and also
// readable in SSR frontmatter. Trailing slash trimmed for clean joins.
const API_BASE = (import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '')

export function apiBase(): string {
  return API_BASE
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { accept: 'application/json' } })
  if (!res.ok) {
    const error = new Error(`API ${res.status} for ${path}`) as Error & { status?: number }
    error.status = res.status
    throw error
  }
  return (await res.json()) as T
}

// Catalog/featured query. All keys optional; only defined values are appended.
export interface PropertyQuery {
  direction?: string
  country?: string
  category?: string
  city?: string
  type?: string
  rooms?: number
  minPrice?: number
  maxPrice?: number
  minArea?: number
  maxArea?: number
  premium?: boolean
  installment?: boolean
  isNewBuilding?: boolean
  q?: string
  sort?: string
  page?: number
  limit?: number
}

export function buildQuery(query: PropertyQuery): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export async function listProperties(query: PropertyQuery = {}): Promise<PropertyListResponse> {
  try {
    return await getJson<PropertyListResponse>(`/api/properties${buildQuery(query)}`)
  } catch (error) {
    console.error('[api] listProperties failed', error)
    const limit = query.limit ?? 24
    return { items: [], total: 0, page: query.page ?? 1, limit, pageCount: 0 }
  }
}

// Distinct published cities per country for the catalog City filter.
export async function listCities(): Promise<PropertyCityFacet[]> {
  try {
    const { cities } = await getJson<PropertyCitiesResponse>('/api/properties/cities')
    return cities
  } catch (error) {
    console.error('[api] listCities failed', error)
    return []
  }
}

// Residential complexes (ЖК) catalog + detail.
export interface ComplexQuery {
  city?: string
  premium?: boolean
  features?: string[]
  delivery?: string[]
  developer?: string[]
  priceMin?: number
  priceMax?: number
  q?: string
  sort?: string
  page?: number
  limit?: number
}

export async function getComplexFacets(): Promise<ComplexFacetsResponse> {
  try {
    return await getJson<ComplexFacetsResponse>('/api/complexes/facets')
  } catch (error) {
    console.error('[api] getComplexFacets failed', error)
    return { cities: [], features: [], deliveries: [], developers: [] }
  }
}

export async function listComplexes(query: ComplexQuery = {}): Promise<ComplexListResponse> {
  try {
    return await getJson<ComplexListResponse>(`/api/complexes${buildQuery(query)}`)
  } catch (error) {
    console.error('[api] listComplexes failed', error)
    const limit = query.limit ?? 24
    return { items: [], total: 0, page: query.page ?? 1, limit, pageCount: 0 }
  }
}

export async function getComplex(slug: string): Promise<ComplexDetailDto | null> {
  try {
    const { complex } = await getJson<{ complex: ComplexDetailDto }>(`/api/complexes/${slug}`)
    return complex
  } catch (error) {
    if ((error as { status?: number }).status === 404) return null
    console.error('[api] getComplex failed', error)
    return null
  }
}

export type { ComplexDto, ComplexDetailDto }

export async function getProperty(slug: string): Promise<PropertyDto | null> {
  try {
    const { property } = await getJson<{ property: PropertyDto }>(`/api/properties/${slug}`)
    return property
  } catch (error) {
    if ((error as { status?: number }).status === 404) return null
    console.error('[api] getProperty failed', error)
    return null
  }
}

// Resolved single contact for a card (personal → direction → company).
export async function getPropertyContact(slug: string): Promise<ResolvedContactDto | null> {
  try {
    const { contact } = await getJson<{ contact: ResolvedContactDto | null }>(`/api/contacts/property/${slug}`)
    return contact
  } catch (error) {
    console.error('[api] getPropertyContact failed', error)
    return null
  }
}

export async function getHomeContent(): Promise<HomeContentDto | null> {
  try {
    const { content } = await getJson<{ content: HomeContentDto }>(`/api/home`)
    return content
  } catch (error) {
    console.error('[api] getHomeContent failed', error)
    return null
  }
}

export async function getPublicSettings(): Promise<PublicSiteSettingsDto> {
  try {
    const { settings } = await getJson<{ settings: PublicSiteSettingsDto }>(`/api/site`)
    return settings
  } catch (error) {
    console.error('[api] getPublicSettings failed', error)
    return { companyName: null, companyPhone: null, companyContact: null }
  }
}

// Lead submission result discriminates success from a validation/network error
// so the form can show inline messages without throwing.
export type CreateLeadResult =
  | { ok: true; lead: LeadDto }
  | { ok: false; status: number; message: string }

export async function createLead(payload: CreateLeadRequest): Promise<CreateLeadResult> {
  try {
    const res = await fetch(`${API_BASE}/api/leads`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.status === 201) {
      const { lead } = (await res.json()) as { lead: LeadDto }
      return { ok: true, lead }
    }
    const message =
      res.status === 429
        ? 'Слишком много заявок. Попробуйте позже.'
        : 'Не удалось отправить заявку. Проверьте данные и попробуйте ещё раз.'
    return { ok: false, status: res.status, message }
  } catch (error) {
    console.error('[api] createLead failed', error)
    return { ok: false, status: 0, message: 'Нет связи с сервером. Попробуйте позже.' }
  }
}
