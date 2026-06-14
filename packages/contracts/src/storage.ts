import { z } from 'zod'

// Admin photo upload uses presigned PUT URLs: the client asks the backend for a
// short-lived signed URL, then uploads the file bytes directly to object storage.
// The resulting public URL is what gets stored in `Property.photos`.

const filenameSchema = z.string().trim().min(1).max(200)
const contentTypeSchema = z
  .string()
  .trim()
  .min(3)
  .max(120)
  .regex(/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i, 'Invalid content type')

export const uploadNamespaceSchema = z.enum(['properties', 'managers', 'home'])
export type UploadNamespace = z.infer<typeof uploadNamespaceSchema>

export const createUploadUrlSchema = z.object({
  namespace: uploadNamespaceSchema.default('properties'),
  filename: filenameSchema,
  contentType: contentTypeSchema,
  byteSize: z.number().int().positive(),
})

export type CreateUploadUrlRequest = z.input<typeof createUploadUrlSchema>
export type CreateUploadUrlPayload = z.output<typeof createUploadUrlSchema>

export const presignedUploadSchema = z.object({
  key: z.string(),
  uploadUrl: z.string().url(),
  method: z.literal('PUT'),
  headers: z.record(z.string(), z.string()),
  contentLength: z.number().int(),
  expiresAt: z.string().datetime(),
  // Public CDN URL for the uploaded object — stored in the listing once the
  // direct PUT succeeds. Present because admin uploads are public-read.
  publicUrl: z.string().url(),
})

export type PresignedUpload = z.infer<typeof presignedUploadSchema>

export const presignedUploadResponseSchema = z.object({ upload: presignedUploadSchema })
export type PresignedUploadResponse = z.infer<typeof presignedUploadResponseSchema>
