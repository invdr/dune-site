# Storage And Media

Use this document when a product needs uploads, images, media, generated files, or downloadable assets.

The supported storage path is **S3-compatible object storage**:

- An S3-compatible object store for persistent objects (for example self-hosted [MinIO](https://min.io/) on the VPS, or any external S3-compatible provider).
- An optional CDN in front of public images, media, and downloads.
- Backend-issued presigned URLs for direct browser/client uploads and private downloads.
- The application containers only for API/runtime code and short-lived temporary files.

Do not store user uploads or durable generated assets on a container filesystem. Containers are replaced during deployments and rebuilds, and their local filesystem is not durable.

> Env-var naming: the storage variables use the historical `SPACES_*` prefix. They are provider-neutral — they configure any S3-compatible endpoint, bucket, and credentials.

## Intake Before Building File Features

Ask product-level questions before implementation:

- What will users upload: avatars, photos, documents, videos, exports, or something else?
- Are files public, private, shared with selected users, or mixed?
- Which roles can upload, view, replace, and delete files?
- What are the maximum file size and allowed file types?
- Do images need thumbnails, responsive sizes, format conversion, compression, cropping, or moderation?
- How long should files live after the owning record is deleted?
- Should filenames be user-visible, or should the app generate opaque object keys?
- Are uploads required in the first version, or can media be deferred?

Record the answer in the relevant README section when storage affects the active product surface.

## Object Storage Defaults

Use standard (hot) object storage for app media. Avoid archive/cold tiers for public app images or active downloads, since they typically do not support CDN integration.

Recommended production setup:

- One bucket per environment when practical, for example `<project>-prod` and `<project>-staging`.
- Put a CDN in front of public media buckets when latency or custom domains matter.
- Use a custom CDN subdomain such as `images.example.com` when the app has a production domain.
- Store public immutable assets under generated keys and set long cache headers.
- Store private files under separate prefixes or buckets and serve them with short-lived presigned GET URLs.
- Do not put personally identifiable or sensitive information in bucket names, object keys, metadata, or tags.

The backend uses the AWS S3 SDK against the configured endpoint (`SPACES_ENDPOINT`), so any S3-compatible store works. For self-hosted MinIO on the VPS the endpoint is your MinIO URL; for an external provider it is that provider's S3 endpoint.

## Backend Storage Service

The backend storage layer lives in `backend/src/storage`. It is intentionally a service layer, not a product-specific upload feature.

Use it to:

- generate safe object keys;
- issue presigned PUT URLs for direct uploads;
- issue short-lived presigned GET URLs for private downloads;
- build public CDN URLs for public objects;
- delete objects when the owning product record is deleted.

Required env when storage is active:

```bash
SPACES_REGION=us-east-1
SPACES_BUCKET=<project-prod>
SPACES_ENDPOINT=https://<s3-compatible-endpoint>
SPACES_CDN_BASE_URL=https://images.example.com
SPACES_ACCESS_KEY_ID=<access-key>
SPACES_SECRET_ACCESS_KEY=<secret-key>
SPACES_UPLOAD_MAX_BYTES=10485760
SPACES_UPLOAD_URL_TTL_SECONDS=900
SPACES_DOWNLOAD_URL_TTL_SECONDS=300
SPACES_PUBLIC_CACHE_CONTROL="public, max-age=31536000, immutable"
```

Leave these variables blank for projects that do not need uploads yet. If any required storage variable is set, all required storage variables must be set. Set `SPACES_CDN_BASE_URL` to the public base URL clients should use for public objects; without a CDN it can point directly at the bucket's public endpoint.

## Upload Flow

Default direct-upload flow:

1. Authenticated client asks the backend for an upload URL with intended file metadata.
2. Backend validates role, size, content type, owner record, and target key.
3. Backend returns a presigned PUT URL, browser-settable upload headers, and a `contentLength` value when the upload size is part of the signature.
4. Client uploads directly to object storage.
5. Client calls the app API to confirm the uploaded object key.
6. Backend stores object metadata in PostgreSQL if the product needs ownership, deletion, audit, or private access rules.

Browser upload example:

```ts
if (file.size !== upload.contentLength) {
  throw new Error('File size mismatch')
}

await fetch(upload.uploadUrl, {
  method: upload.method,
  headers: upload.headers,
  body: file,
})
```

The presigned PUT URL validates the requested upload intent before signing. If the product must strictly enforce actual stored file size, content type, or image dimensions, verify the uploaded object before confirming it in the app database. When the backend returns a `contentLength` value, the uploaded body must match that exact byte size even if the browser or HTTP client sets the request header automatically.

For public media, the object should be uploaded with `public-read`, immutable object keys, and long cache headers. For private files, keep objects private and return short-lived presigned GET URLs only after permission checks.

If product records store public media URLs instead of only object keys, shared API contracts must reject non-HTTPS schemes such as `javascript:`, `data:`, and `ftp:`. Prefer storing app-owned object keys and deriving public CDN URLs on the backend.

When browser clients upload directly to object storage, configure the bucket's CORS for the deployed origins and allowed upload headers such as `Content-Type`, `Cache-Control`, and `x-amz-acl`. If a CDN is enabled and CORS changed after files were cached, purge the CDN cache.

## Images And Optimization

S3-compatible object storage and a CDN store and deliver images, but they do not provide first-party dynamic image resizing, compression, cropping, or format transformation.

Default image strategy:

- Store the original upload in object storage.
- When optimized images are required, generate app-owned variants in the backend, a worker, or a dedicated image service.
- Store variants with stable keys such as `images/<entity>/<id>/<variant>.webp`.
- Serve public variants through the CDN.
- Keep the original private if users should not download the raw upload.

Use a library such as `sharp` only when implementing image processing for a product feature. Do not add image-processing dependencies or an image proxy just because uploads exist.

If the product needs dynamic transformations by URL, consider a dedicated container running an image proxy such as `imgproxy`, backed by object storage. Use third-party services such as Cloudinary or ImageKit only when the user explicitly chooses that tradeoff.

## CDN And Caching

Put a CDN in front of public media and downloads to reduce latency and origin load.

Operational rules:

- Prefer immutable object keys for public assets so replacing content creates a new URL.
- Use long cache headers for immutable assets.
- Purge the CDN only for urgent corrections or when mutable URLs cannot be avoided.
- Do not rely on CDN caching for presigned private URLs; presigned requests are forwarded to the origin and do not benefit from cache hits.

## Security And Privacy

- Never commit storage access keys or secrets.
- Use limited-access keys scoped to the app bucket when possible.
- Keep private files private; do not use obscurity-only public URLs for sensitive data.
- Validate MIME type, size, owner, and permissions before issuing upload or download URLs.
- Generate object keys server-side. Do not trust client-provided paths.
- Do not include emails, names, customer IDs, or other sensitive data in object keys.
- Delete or orphan-clean objects when the owning product record is deleted, according to the product retention policy.

## Current Upstream Documentation

- Amazon S3 API reference (the de-facto S3 protocol): https://docs.aws.amazon.com/AmazonS3/latest/API/Welcome.html
- AWS SDK for JavaScript v3 S3 client: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/
- MinIO (self-hosted S3-compatible storage): https://min.io/docs/minio/linux/index.html
- Presigned URLs with the AWS SDK: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/s3-example-presigned-url.html
