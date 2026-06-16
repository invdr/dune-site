import type { ObjectStorage } from '../storage/object-storage'

// Mirrors remote listing photos into our own S3-compatible bucket so the
// catalog no longer depends on sellox.ru staying online. Pure orchestration
// over an injected StorageService and fetcher — no provider specifics here.

export type FetchedPhoto = { bytes: Uint8Array; contentType: string }
export type PhotoFetcher = (url: string) => Promise<FetchedPhoto>

export type MirrorResult = {
  // New photo list: mirrored public URLs where upload succeeded, original
  // remote URLs where it failed (so a single bad image never drops a gallery).
  photos: string[]
  mirrored: number
  failed: number
}

const defaultPhotoFetcher: PhotoFetcher = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  const headerType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
  const contentType = headerType && headerType.startsWith('image/') ? headerType : contentTypeFromUrl(url)
  return { bytes, contentType }
}

export type MirrorOptions = {
  fetcher?: PhotoFetcher
  // Sub-path under the complex folder, e.g. "plans" for floor plans. Keeps
  // photos and plans in separate, predictable locations on disk.
  subdir?: string
  // SSRF allowlist: only these hosts are fetched server-side. The URL list comes
  // from untrusted third-party HTML, so the host check lives here at the fetch
  // boundary rather than relying on the parser's source regex two layers up.
  allowedHosts?: ReadonlySet<string>
}

// sellox.ru is the only host the importer ever mirrors from.
const SELLOX_HOSTS: ReadonlySet<string> = new Set(['sellox.ru', 'www.sellox.ru'])

function isAllowedHost(url: string, allowed: ReadonlySet<string>): boolean {
  try {
    const { protocol, hostname } = new URL(url)
    return (protocol === 'https:' || protocol === 'http:') && allowed.has(hostname.toLowerCase())
  } catch {
    return false
  }
}

// Downloads each image and re-uploads it under a stable, per-complex key. Stable
// keys make re-runs idempotent (the same object is overwritten, not duplicated).
export async function mirrorPhotos(
  storage: ObjectStorage,
  slug: string,
  urls: string[],
  options: MirrorOptions = {},
): Promise<MirrorResult> {
  const fetcher = options.fetcher ?? defaultPhotoFetcher
  const allowedHosts = options.allowedHosts ?? SELLOX_HOSTS
  const prefix = options.subdir ? `complexes/sellox/${slug}/${options.subdir}` : `complexes/sellox/${slug}`
  const photos: string[] = []
  let mirrored = 0
  let failed = 0

  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index]
    // Never issue a server-side fetch to a host outside the allowlist; keep the
    // original URL so the gallery still renders, but don't mirror it.
    if (!isAllowedHost(url, allowedHosts)) {
      photos.push(url)
      failed += 1
      continue
    }
    try {
      const { bytes, contentType } = await fetcher(url)
      const ext = extensionForContentType(contentType) ?? extensionFromUrl(url) ?? 'jpg'
      const key = `${prefix}/${String(index + 1).padStart(2, '0')}.${ext}`
      const { publicUrl } = await storage.putObject({ key, body: bytes, contentType, visibility: 'public' })
      photos.push(publicUrl ?? url)
      mirrored += 1
    } catch {
      // Keep the original remote URL; the import still succeeds with a gallery.
      photos.push(url)
      failed += 1
    }
  }

  return { photos, mirrored, failed }
}

const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/avif': 'avif',
}

function extensionForContentType(contentType: string): string | null {
  return CONTENT_TYPE_EXTENSIONS[contentType.toLowerCase()] ?? null
}

function extensionFromUrl(url: string): string | null {
  const path = decodeURIComponent(url.replace(/[?#].*$/, ''))
  const match = path.match(/\.(webp|jpe?g|png|gif|avif)$/i)
  return match ? match[1].toLowerCase().replace('jpeg', 'jpg') : null
}

function contentTypeFromUrl(url: string): string {
  const ext = extensionFromUrl(url)
  const entry = Object.entries(CONTENT_TYPE_EXTENSIONS).find(([, value]) => value === ext)
  return entry ? entry[0] : 'application/octet-stream'
}
