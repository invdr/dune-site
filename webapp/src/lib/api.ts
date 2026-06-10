import {
  apiErrorSchema,
  authResponseSchema,
  createManagerSchema,
  createPropertySchema,
  createUploadUrlSchema,
  homeContentResponseSchema,
  leadListResponseSchema,
  leadResponseSchema,
  loginRequestSchema,
  logoutRequestSchema,
  managerListResponseSchema,
  managerResponseSchema,
  meResponseSchema,
  presignedUploadResponseSchema,
  propertyListResponseSchema,
  propertyResponseSchema,
  refreshRequestSchema,
  refreshResponseSchema,
  registerRequestSchema,
  siteSettingsResponseSchema,
  updateHomeContentSchema,
  updateLeadSchema,
  updateManagerSchema,
  updatePropertySchema,
  updateSiteSettingsSchema,
  type AdminPropertyListQuery,
  type AuthResponse,
  type CreateManagerRequest,
  type CreatePropertyRequest,
  type CreateUploadUrlRequest,
  type HomeContentResponse,
  type LeadListQuery,
  type LeadListResponse,
  type LeadResponse,
  type LoginRequest,
  type LogoutRequest,
  type ManagerListResponse,
  type ManagerResponse,
  type MeResponse,
  type PresignedUploadResponse,
  type PropertyListResponse,
  type PropertyResponse,
  type RefreshRequest,
  type RefreshResponse,
  type RegisterRequest,
  type SiteSettingsResponse,
  type UpdateHomeContentRequest,
  type UpdateLeadRequest,
  type UpdateManagerRequest,
  type UpdatePropertyRequest,
  type UpdateSiteSettingsRequest,
} from '@dune/contracts'
import type { z } from 'zod'

const apiBaseUrl = (import.meta.env?.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '')

type ApiClientOptions = {
  getAccessToken: () => string | null
  setAccessToken: (accessToken: string | null) => void
  onAuthExpired?: () => void | Promise<void>
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  auth?: boolean
  retryOnUnauthorized?: boolean
  accessTokenOverride?: string
}

// Drops undefined entries so optional admin filters never serialize as
// "?status=undefined". Values are coerced to strings for the query string.
function buildQuery(params: Record<string, unknown>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

export class ApiRequestError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export class ApiClient {
  private readonly options: ApiClientOptions
  private refreshPromise: Promise<RefreshResponse> | null = null

  constructor(options: ApiClientOptions) {
    this.options = options
  }

  register(input: RegisterRequest): Promise<AuthResponse> {
    const payload = registerRequestSchema.parse(input)
    return this.request('/api/auth/register', authResponseSchema, {
      method: 'POST',
      body: payload,
      auth: false,
    })
  }

  login(input: LoginRequest): Promise<AuthResponse> {
    const payload = loginRequestSchema.parse(input)
    return this.request('/api/auth/login', authResponseSchema, {
      method: 'POST',
      body: payload,
      auth: false,
    })
  }

  refresh(input: RefreshRequest = {}): Promise<RefreshResponse> {
    const payload = refreshRequestSchema.parse(input)
    return this.request('/api/auth/refresh', refreshResponseSchema, {
      method: 'POST',
      body: payload,
      auth: false,
      retryOnUnauthorized: false,
    })
  }

  me(): Promise<MeResponse> {
    return this.request('/api/auth/me', meResponseSchema, {
      auth: true,
    })
  }

  // --- Admin: properties ---

  listProperties(query: Partial<AdminPropertyListQuery> = {}): Promise<PropertyListResponse> {
    return this.request(`/api/admin/properties${buildQuery(query)}`, propertyListResponseSchema, {
      auth: true,
    })
  }

  getProperty(id: string): Promise<PropertyResponse> {
    return this.request(`/api/admin/properties/${id}`, propertyResponseSchema, { auth: true })
  }

  createProperty(input: CreatePropertyRequest): Promise<PropertyResponse> {
    const payload = createPropertySchema.parse(input)
    return this.request('/api/admin/properties', propertyResponseSchema, {
      method: 'POST',
      body: payload,
      auth: true,
    })
  }

  updateProperty(id: string, input: UpdatePropertyRequest): Promise<PropertyResponse> {
    const payload = updatePropertySchema.parse(input)
    return this.request(`/api/admin/properties/${id}`, propertyResponseSchema, {
      method: 'PUT',
      body: payload,
      auth: true,
    })
  }

  async deleteProperty(id: string): Promise<void> {
    await this.rawRequest(`/api/admin/properties/${id}`, { method: 'DELETE', auth: true })
  }

  // --- Admin: leads ---

  listLeads(query: Partial<LeadListQuery> = {}): Promise<LeadListResponse> {
    return this.request(`/api/admin/leads${buildQuery(query)}`, leadListResponseSchema, {
      auth: true,
    })
  }

  updateLead(id: string, input: UpdateLeadRequest): Promise<LeadResponse> {
    const payload = updateLeadSchema.parse(input)
    return this.request(`/api/admin/leads/${id}`, leadResponseSchema, {
      method: 'PATCH',
      body: payload,
      auth: true,
    })
  }

  // --- Admin: managers ---

  listManagers(): Promise<ManagerListResponse> {
    return this.request('/api/admin/managers', managerListResponseSchema, { auth: true })
  }

  createManager(input: CreateManagerRequest): Promise<ManagerResponse> {
    const payload = createManagerSchema.parse(input)
    return this.request('/api/admin/managers', managerResponseSchema, {
      method: 'POST',
      body: payload,
      auth: true,
    })
  }

  updateManager(id: string, input: UpdateManagerRequest): Promise<ManagerResponse> {
    const payload = updateManagerSchema.parse(input)
    return this.request(`/api/admin/managers/${id}`, managerResponseSchema, {
      method: 'PUT',
      body: payload,
      auth: true,
    })
  }

  async deleteManager(id: string): Promise<void> {
    await this.rawRequest(`/api/admin/managers/${id}`, { method: 'DELETE', auth: true })
  }

  // --- Admin: site settings + home content ---

  getSettings(): Promise<SiteSettingsResponse> {
    return this.request('/api/admin/settings', siteSettingsResponseSchema, { auth: true })
  }

  updateSettings(input: UpdateSiteSettingsRequest): Promise<SiteSettingsResponse> {
    const payload = updateSiteSettingsSchema.parse(input)
    return this.request('/api/admin/settings', siteSettingsResponseSchema, {
      method: 'PUT',
      body: payload,
      auth: true,
    })
  }

  getHomeContent(): Promise<HomeContentResponse> {
    return this.request('/api/admin/home', homeContentResponseSchema, { auth: true })
  }

  updateHomeContent(input: UpdateHomeContentRequest): Promise<HomeContentResponse> {
    const payload = updateHomeContentSchema.parse(input)
    return this.request('/api/admin/home', homeContentResponseSchema, {
      method: 'PUT',
      body: payload,
      auth: true,
    })
  }

  // --- Admin: photo uploads (presigned PUT to object storage) ---

  createUploadUrl(input: CreateUploadUrlRequest): Promise<PresignedUploadResponse> {
    const payload = createUploadUrlSchema.parse(input)
    return this.request('/api/admin/uploads', presignedUploadResponseSchema, {
      method: 'POST',
      body: payload,
      auth: true,
    })
  }

  async logout(input: LogoutRequest = {}) {
    const payload = logoutRequestSchema.parse(input)
    await this.rawRequest('/api/auth/logout', {
      method: 'POST',
      body: payload,
      auth: false,
      retryOnUnauthorized: false,
    })
  }

  async expireSession() {
    this.options.setAccessToken(null)
    await this.rawRequest('/api/auth/logout', {
      method: 'POST',
      body: {},
      auth: false,
      retryOnUnauthorized: false,
    }).catch(() => undefined)
    await this.options.onAuthExpired?.()
  }

  private async request<TSchema extends z.ZodType>(
    path: string,
    schema: TSchema,
    options: RequestOptions,
  ): Promise<z.infer<TSchema>> {
    const response = await this.rawRequest(path, options)
    const data = await response.json()
    return schema.parse(data)
  }

  private async rawRequest(path: string, options: RequestOptions): Promise<Response> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers: this.headers(options),
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })

    if (response.status === 401 && options.auth && options.retryOnUnauthorized !== false) {
      const refreshed = await this.refreshOnce().catch(async (error: unknown) => {
        await this.expireSession()
        throw error
      })
      this.options.setAccessToken(refreshed.accessToken)
      return this.rawRequest(path, {
        ...options,
        accessTokenOverride: refreshed.accessToken,
        retryOnUnauthorized: false,
      })
    }

    if (!response.ok) {
      throw await toApiError(response)
    }

    return response
  }

  private refreshOnce() {
    this.refreshPromise ??= this.refresh().finally(() => {
      this.refreshPromise = null
    })

    return this.refreshPromise
  }

  private headers(options: RequestOptions) {
    const headers = new Headers({
      'X-Client-Platform': 'web',
    })

    if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json')
    }

    if (options.auth) {
      const accessToken = options.accessTokenOverride ?? this.options.getAccessToken()
      if (accessToken) {
        headers.set('Authorization', `Bearer ${accessToken}`)
      }
    }

    return headers
  }
}

async function toApiError(response: Response) {
  const fallbackMessage = `Request failed with status ${response.status}`

  try {
    const parsed = apiErrorSchema.parse(await response.json())
    return new ApiRequestError(response.status, parsed.error.code, parsed.error.message)
  } catch {
    return new ApiRequestError(response.status, 'INTERNAL_ERROR', fallbackMessage)
  }
}
