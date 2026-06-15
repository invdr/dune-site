import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { AppError } from '../http/errors'
import { assertSafeObjectKey, joinUrlPath, type PutObjectInput, type PutObjectResult } from './service'

// Local-disk object storage for single-VPS deployments: objects are written
// under a media root and served back by nginx from a public base URL. Mirrors
// the slice of StorageService the importer uses (putObject), so callers can swap
// between S3 and local disk without caring which is active.

export type LocalStorageConfig = {
  // Filesystem directory that holds the objects, e.g. "/opt/dune/media".
  root: string
  // Public base URL nginx serves that directory from, e.g. "https://dunestate.ru/media".
  publicBaseUrl: string
  uploadMaxBytes: number
}

export class LocalStorage {
  constructor(private readonly config: LocalStorageConfig) {}

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const key = assertSafeObjectKey(input.key)
    const byteSize = input.body.byteLength
    if (!Number.isInteger(byteSize) || byteSize <= 0 || byteSize > this.config.uploadMaxBytes) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Upload size is outside the allowed range', {
        maxBytes: this.config.uploadMaxBytes,
      })
    }

    // `key` is already validated to be relative with no traversal segments, so
    // it cannot escape the media root.
    const filePath = join(this.config.root, key)
    await mkdir(dirname(filePath), { recursive: true })
    // World-readable so the nginx worker (a different user) can serve the file.
    await writeFile(filePath, input.body, { mode: 0o644 })

    return { key, byteSize, publicUrl: joinUrlPath(this.config.publicBaseUrl, key) }
  }
}
