import { describe, expect, test } from 'bun:test'

import type { StorageService } from '../storage/service'
import { mirrorPhotos, type PhotoFetcher } from './photos'

// A StorageService stand-in: records uploads and echoes a deterministic public
// URL so the test can assert keys, content types, and the rewritten gallery.
function fakeStorage() {
  const uploads: Array<{ key: string; contentType: string; byteSize: number }> = []
  const service = {
    putObject: async ({ key, body, contentType }: { key: string; body: Uint8Array; contentType: string }) => {
      uploads.push({ key, contentType, byteSize: body.byteLength })
      return { key, byteSize: body.byteLength, publicUrl: `https://cdn.example.com/${key}` }
    },
  } as unknown as StorageService
  return { service, uploads }
}

const fetcherFor = (byType: Record<string, { bytes: Uint8Array; contentType: string } | 'error'>): PhotoFetcher => {
  return async (url) => {
    const result = byType[url]
    if (!result || result === 'error') throw new Error(`boom ${url}`)
    return result
  }
}

describe('mirrorPhotos', () => {
  test('uploads each photo under a stable per-complex key and rewrites URLs', async () => {
    const { service, uploads } = fakeStorage()
    const fetcher = fetcherFor({
      'https://sellox.ru/a.webp': { bytes: new Uint8Array([1, 2]), contentType: 'image/webp' },
      'https://sellox.ru/b.jpg': { bytes: new Uint8Array([3, 4, 5]), contentType: 'image/jpeg' },
    })

    const result = await mirrorPhotos(service, 'zhk-prestizh', ['https://sellox.ru/a.webp', 'https://sellox.ru/b.jpg'], {
      fetcher,
    })

    expect(result.mirrored).toBe(2)
    expect(result.failed).toBe(0)
    expect(result.photos).toEqual([
      'https://cdn.example.com/complexes/sellox/zhk-prestizh/01.webp',
      'https://cdn.example.com/complexes/sellox/zhk-prestizh/02.jpg',
    ])
    expect(uploads.map((u) => u.key)).toEqual([
      'complexes/sellox/zhk-prestizh/01.webp',
      'complexes/sellox/zhk-prestizh/02.jpg',
    ])
  })

  test('routes floor plans into a plans/ subfolder', async () => {
    const { service, uploads } = fakeStorage()
    const fetcher = fetcherFor({
      'https://sellox.ru/plan.webp': { bytes: new Uint8Array([1]), contentType: 'image/webp' },
    })

    const result = await mirrorPhotos(service, 'zhk-x', ['https://sellox.ru/plan.webp'], { fetcher, subdir: 'plans' })

    expect(uploads[0].key).toBe('complexes/sellox/zhk-x/plans/01.webp')
    expect(result.photos).toEqual(['https://cdn.example.com/complexes/sellox/zhk-x/plans/01.webp'])
  })

  test('derives the extension from the URL when the content type is generic', async () => {
    const { service, uploads } = fakeStorage()
    const fetcher = fetcherFor({
      'https://sellox.ru/photo.png': { bytes: new Uint8Array([9]), contentType: 'application/octet-stream' },
    })

    await mirrorPhotos(service, 'zhk-x', ['https://sellox.ru/photo.png'], { fetcher })

    expect(uploads[0].key).toBe('complexes/sellox/zhk-x/01.png')
  })

  test('a failed photo keeps its original URL and does not drop the gallery', async () => {
    const { service } = fakeStorage()
    const fetcher = fetcherFor({
      'https://sellox.ru/ok.webp': { bytes: new Uint8Array([1]), contentType: 'image/webp' },
      'https://sellox.ru/bad.webp': 'error',
    })

    const result = await mirrorPhotos(service, 'zhk-y', ['https://sellox.ru/ok.webp', 'https://sellox.ru/bad.webp'], {
      fetcher,
    })

    expect(result.mirrored).toBe(1)
    expect(result.failed).toBe(1)
    expect(result.photos).toEqual([
      'https://cdn.example.com/complexes/sellox/zhk-y/01.webp',
      'https://sellox.ru/bad.webp',
    ])
  })
})
