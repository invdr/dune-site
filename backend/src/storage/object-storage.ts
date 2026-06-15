import type { AppEnv } from '../env'
import { LocalStorage } from './local'
import { createStorageServiceFromEnv, type PutObjectInput, type PutObjectResult } from './service'

// The minimal write surface shared by the S3 (StorageService) and local-disk
// (LocalStorage) backends. Server-side ingestion (e.g. the sellox photo mirror)
// depends on this, not on a concrete provider.
export interface ObjectStorage {
  putObject(input: PutObjectInput): Promise<PutObjectResult>
}

// Picks the active media backend from the environment. The local-disk driver
// wins when configured (single-VPS deployments), otherwise S3-compatible
// storage is used. Returns null when neither is configured.
export function resolveObjectStorage(env: AppEnv): ObjectStorage | null {
  if (env.MEDIA_LOCAL_ROOT && env.MEDIA_PUBLIC_BASE_URL) {
    return new LocalStorage({
      root: env.MEDIA_LOCAL_ROOT,
      publicBaseUrl: env.MEDIA_PUBLIC_BASE_URL,
      uploadMaxBytes: env.SPACES_UPLOAD_MAX_BYTES,
    })
  }
  return createStorageServiceFromEnv(env)
}
