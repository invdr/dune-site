import { describe, expect, test } from 'bun:test'

import { loadEnv } from '../env'
import { LocalStorage } from './local'
import { resolveObjectStorage } from './object-storage'
import { StorageService } from './service'

const baseEnv = {
  DATABASE_URL: 'postgres://localhost:5432/dune',
  JWT_SECRET: 'x'.repeat(40),
}

describe('resolveObjectStorage', () => {
  test('uses the local-disk driver when MEDIA_* is configured', () => {
    const env = loadEnv({
      ...baseEnv,
      MEDIA_LOCAL_ROOT: '/opt/dune/media',
      MEDIA_PUBLIC_BASE_URL: 'https://dunestate.ru/media',
    })
    expect(resolveObjectStorage(env)).toBeInstanceOf(LocalStorage)
  })

  test('falls back to S3-compatible storage when only SPACES_* is configured', () => {
    const env = loadEnv({
      ...baseEnv,
      SPACES_REGION: 'ru-central1',
      SPACES_BUCKET: 'dune-media',
      SPACES_ENDPOINT: 'https://storage.yandexcloud.net',
      SPACES_ACCESS_KEY_ID: 'key',
      SPACES_SECRET_ACCESS_KEY: 'secret',
    })
    expect(resolveObjectStorage(env)).toBeInstanceOf(StorageService)
  })

  test('returns null when no media backend is configured', () => {
    expect(resolveObjectStorage(loadEnv(baseEnv))).toBeNull()
  })
})
