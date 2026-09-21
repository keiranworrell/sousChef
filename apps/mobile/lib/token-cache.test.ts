import { describe, expect, it } from "vitest";
import { TOKEN_SKEW_MS, expiryFromClaim, needsRefresh } from "./token-cache";

const NOW = 1_800_000_000_000;

describe("needsRefresh", () => {
  it("refreshes when nothing is cached", () => {
    expect(needsRefresh(null, NOW)).toBe(true);
  });

  it("reuses a token with plenty of life left", () => {
    expect(needsRefresh(NOW + 30 * 60_000, NOW)).toBe(false);
  });

  it("refreshes an expired token", () => {
    expect(needsRefresh(NOW - 1, NOW)).toBe(true);
  });

  it("refreshes before expiry, not at it", () => {
    // A token valid for two more seconds will not be valid by the time the
    // request reaches API Gateway, and that 401 looks like being signed out.
    expect(needsRefresh(NOW + 2_000, NOW)).toBe(true);
    expect(needsRefresh(NOW + TOKEN_SKEW_MS + 1, NOW)).toBe(false);
  });

  it("treats the skew boundary as due", () => {
    expect(needsRefresh(NOW + TOKEN_SKEW_MS, NOW)).toBe(true);
  });

  it("honours a custom skew", () => {
    expect(needsRefresh(NOW + 5_000, NOW, 1_000)).toBe(false);
    expect(needsRefresh(NOW + 5_000, NOW, 10_000)).toBe(true);
  });
});

describe("expiryFromClaim", () => {
  it("converts seconds to milliseconds", () => {
    // The bug this guards: `exp` is in seconds, Date.now() is in milliseconds.
    // Comparing them directly puts every expiry in 1970, so every call
    // refreshes and the cache silently does nothing — no error, just the
    // slowness it was meant to remove.
    expect(expiryFromClaim(1_800_000_000)).toBe(1_800_000_000_000);
  });

  it("produces a value in the future for a plausible token", () => {
    const inAnHour = Math.floor(NOW / 1000) + 3600;
    expect(needsRefresh(expiryFromClaim(inAnHour), NOW)).toBe(false);
  });

  it("returns null for anything it cannot use", () => {
    for (const bad of [undefined, null, "1800000000", NaN, Infinity, 0, -1, {}]) {
      expect(expiryFromClaim(bad), String(bad)).toBeNull();
    }
  });

  it("a null claim means refresh", () => {
    expect(needsRefresh(expiryFromClaim(undefined), NOW)).toBe(true);
  });
});
