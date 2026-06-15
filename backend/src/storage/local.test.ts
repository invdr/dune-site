import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import { AppError } from '../http/errors'
import { LocalStorage } from './local'

let root: string

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'dune-media-'))
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('LocalStorage', () => {
  test('writes bytes under the root and returns the public URL', async () => {
    const storage = new LocalStorage({ root, publicBaseUrl: 'https://dunestate.ru/media', uploadMaxBytes: 1024 })

    const result = await storage.putObject({
      key: 'complexes/sellox/zhk-prestizh/01.webp',
      body: new Uint8Array([1, 2, 3, 4]),
      contentType: 'image/webp',
      visibility: 'public',
    })

    expect(result).toEqual({
      key: 'complexes/sellox/zhk-prestizh/01.webp',
      byteSize: 4,
      publicUrl: 'https://dunestate.ru/media/complexes/sellox/zhk-prestizh/01.webp',
    })

    const written = await readFile(join(root, 'complexes/sellox/zhk-prestizh/01.webp'))
    expect(Array.from(written)).toEqual([1, 2, 3, 4])
  })

  test('rejects unsafe keys that would escape the root', async () => {
    const storage = new LocalStorage({ root, publicBaseUrl: 'https://dunestate.ru/media', uploadMaxBytes: 1024 })
    await expect(
      storage.putObject({ key: '../escape.webp', body: new Uint8Array([1]), contentType: 'image/webp' }),
    ).rejects.toThrow(AppError)
  })

  test('rejects bytes over the configured limit', async () => {
    const storage = new LocalStorage({ root, publicBaseUrl: 'https://dunestate.ru/media', uploadMaxBytes: 2 })
    await expect(
      storage.putObject({ key: 'big.webp', body: new Uint8Array(8), contentType: 'image/webp' }),
    ).rejects.toThrow(AppError)
  })
})
