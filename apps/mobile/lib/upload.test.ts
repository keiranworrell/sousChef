import { describe, expect, it } from "vitest";
import { extensionForMime, mimeTypeForUpload, uploadSucceeded } from "./upload";

describe("uploadSucceeded", () => {
  it("accepts the 2xx range", () => {
    expect(uploadSucceeded(200)).toBe(true);
    expect(uploadSucceeded(204)).toBe(true);
    expect(uploadSucceeded(299)).toBe(true);
  });

  it("rejects everything else", () => {
    // The one that matters: File.upload() resolves on a non-2xx, so an expired
    // presigned URL returning 403 arrives as an ordinary resolved promise. Not
    // checking this saves a CDN URL pointing at nothing.
    expect(uploadSucceeded(403)).toBe(false);
    expect(uploadSucceeded(400)).toBe(false);
    expect(uploadSucceeded(500)).toBe(false);
    expect(uploadSucceeded(302)).toBe(false);
    expect(uploadSucceeded(199)).toBe(false);
  });
});

describe("extensionForMime", () => {
  it("maps the types a camera roll produces", () => {
    expect(extensionForMime("image/jpeg")).toBe("jpg");
    expect(extensionForMime("image/png")).toBe("png");
    expect(extensionForMime("image/heic")).toBe("heic");
    expect(extensionForMime("image/webp")).toBe("webp");
  });

  it("ignores case and parameters", () => {
    expect(extensionForMime("IMAGE/PNG")).toBe("png");
    expect(extensionForMime("image/jpeg; charset=binary")).toBe("jpg");
  });

  it("falls back rather than throwing", () => {
    // An unknown type from a camera roll is not worth failing an avatar change
    // over, and S3 matches on the content type that was signed regardless.
    expect(extensionForMime("image/avif")).toBe("jpg");
    expect(extensionForMime(null)).toBe("jpg");
    expect(extensionForMime(undefined)).toBe("jpg");
    expect(extensionForMime("")).toBe("jpg");
  });
});

describe("mimeTypeForUpload", () => {
  it("passes a real image type through", () => {
    expect(mimeTypeForUpload("image/png")).toBe("image/png");
    expect(mimeTypeForUpload("IMAGE/HEIC")).toBe("image/heic");
  });

  it("defaults when the picker gives nothing", () => {
    // expo-image-picker reports a mime type on Android but not reliably on
    // iOS, and an empty content type produces a URL S3 will refuse to match.
    expect(mimeTypeForUpload(undefined)).toBe("image/jpeg");
    expect(mimeTypeForUpload(null)).toBe("image/jpeg");
    expect(mimeTypeForUpload("")).toBe("image/jpeg");
  });

  it("refuses a non-image type", () => {
    expect(mimeTypeForUpload("application/pdf")).toBe("image/jpeg");
  });
});
