import type { StorageService } from '../storage/service'

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

// Downloads each photo and re-uploads it under a stable, per-complex key. Stable
// keys make re-runs idempotent (the same object is overwritten, not duplicated).
export async function mirrorPhotos(
  storage: StorageService,
  slug: string,
  urls: string[],
  fetcher: PhotoFetcher = defaultPhotoFetcher,
): Promise<MirrorResult> {
  const photos: string[] = []
  let mirrored = 0
  let failed = 0

  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index]
    try {
      const { bytes, contentType } = await fetcher(url)
      const ext = extensionForContentType(contentType) ?? extensionFromUrl(url) ?? 'jpg'
      const key = `complexes/sellox/${slug}/${String(index + 1).padStart(2, '0')}.${ext}`
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
