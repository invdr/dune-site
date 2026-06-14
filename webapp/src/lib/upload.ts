import type { UploadNamespace } from '@dune/contracts'

import type { ApiClient } from './api'

// Two-step upload: ask the backend for a presigned PUT target, then send the
// file bytes straight to object storage. Returns the stored public URL.
export async function uploadFile(
  api: ApiClient,
  file: File,
  namespace: UploadNamespace = 'properties',
): Promise<string> {
  const { upload } = await api.createUploadUrl({
    namespace,
    filename: file.name,
    contentType: file.type || 'application/octet-stream',
    byteSize: file.size,
  })

  const response = await fetch(upload.uploadUrl, {
    method: 'PUT',
    headers: upload.headers,
    body: file,
  })

  if (!response.ok) {
    throw new Error(`Не удалось загрузить файл (storage ответил ${response.status})`)
  }

  return upload.publicUrl
}
