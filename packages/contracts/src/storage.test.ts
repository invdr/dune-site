import { describe, expect, test } from 'bun:test'

import { createUploadUrlSchema, presignedUploadSchema } from './storage'

describe('storage upload contracts', () => {
  test('defaults namespace to properties and accepts a valid request', () => {
    const result = createUploadUrlSchema.parse({
      filename: 'villa-front.jpg',
      contentType: 'image/jpeg',
      byteSize: 204_800,
    })
    expect(result.namespace).toBe('properties')
    expect(result.filename).toBe('villa-front.jpg')
  })

  test('rejects a non-positive byte size and an unknown namespace', () => {
    expect(
      createUploadUrlSchema.safeParse({
        filename: 'a.jpg',
        contentType: 'image/jpeg',
        byteSize: 0,
      }).success,
    ).toBe(false)
    expect(
      createUploadUrlSchema.safeParse({
        namespace: 'avatars',
        filename: 'a.jpg',
        contentType: 'image/jpeg',
        byteSize: 10,
      }).success,
    ).toBe(false)
  })

  test('parses a presigned upload response shape', () => {
    const result = presignedUploadSchema.parse({
      key: 'properties/2026/06/10/abc-villa.jpg',
      uploadUrl: 'https://bucket.example.com/properties/abc-villa.jpg?sig=1',
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg', 'x-amz-acl': 'public-read' },
      contentLength: 204_800,
      expiresAt: '2026-06-10T00:00:00.000Z',
      publicUrl: 'https://cdn.example.com/properties/abc-villa.jpg',
    })
    expect(result.method).toBe('PUT')
    expect(result.publicUrl).toContain('cdn.example.com')
  })
})
