/**
 * The bits of uploading to a presigned S3 URL that are worth testing.
 *
 * The upload itself is a native call and cannot run here; these are the two
 * decisions around it that can quietly be wrong.
 */

/**
 * Whether the presigned PUT actually worked.
 *
 * This exists because `File.upload()` **resolves on a non-2xx response** — its
 * own docs say it rejects only when the file cannot be read, the request
 * fails, or the upload is cancelled. So a 403 from an expired presigned URL
 * comes back as a perfectly ordinary resolved promise, and a plain
 * `await file.upload(...)` would treat a rejected upload as a success and save
 * a CDN URL pointing at nothing.
 *
 * Unlike `fetch`, where `res.ok` makes this obvious, here there is nothing to
 * remind you. Hence a named function and a test.
 */
export function uploadSucceeded(status: number): boolean {
  return status >= 200 && status < 300;
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/webp": "webp",
};

/**
 * A filename extension for a mime type.
 *
 * The presigned URL is issued against a content type, and the local file we
 * write before uploading should match it — a `.jpg` holding PNG bytes is the
 * kind of thing that works everywhere until it meets something strict.
 *
 * Falls back to `jpg` rather than throwing: an unknown type from a camera roll
 * is not worth failing an avatar change over, and the content type sent to S3
 * is the one the server signed for either way.
 */
export function extensionForMime(mimeType: string | null | undefined): string {
  if (!mimeType) return "jpg";
  return EXTENSIONS[mimeType.toLowerCase().split(";")[0]!.trim()] ?? "jpg";
}

/**
 * The mime type to ask the server to sign for.
 *
 * expo-image-picker gives a mime type on Android but not always on iOS, and an
 * empty content type produces a presigned URL that S3 will refuse to match.
 */
export function mimeTypeForUpload(assetMimeType: string | null | undefined): string {
  const cleaned = assetMimeType?.toLowerCase().split(";")[0]?.trim();
  if (cleaned && cleaned.startsWith("image/")) return cleaned;
  return "image/jpeg";
}
