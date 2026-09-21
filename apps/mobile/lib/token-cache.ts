/**
 * When a cached auth token needs replacing.
 *
 * Pulled out of the client so the one decision with an off-by-one in it can be
 * tested. Everything else in `api.ts` is plumbing.
 */

/**
 * Refresh slightly before the token actually expires.
 *
 * A token that is valid for another two seconds will not be valid by the time
 * the request reaches API Gateway, and the resulting 401 is indistinguishable
 * to the user from being signed out. Sixty seconds is comfortably longer than
 * any request this app makes.
 */
export const TOKEN_SKEW_MS = 60_000;

/**
 * Whether to fetch a fresh session.
 *
 * `expiresAt` is null when nothing is cached yet, which is also a refresh —
 * the first call of the app's life has nothing to reuse.
 */
export function needsRefresh(
  expiresAt: number | null,
  now: number,
  skewMs: number = TOKEN_SKEW_MS,
): boolean {
  if (expiresAt === null) return true;
  return now >= expiresAt - skewMs;
}

/**
 * The expiry of a JWT, in milliseconds, from its `exp` claim.
 *
 * `exp` is in *seconds* since the epoch — JWTs are specified that way and
 * `Date.now()` is not. Treating one as the other puts expiry in 1970, which
 * means every single call refreshes and the cache silently does nothing:
 * no error, no failure, just the slowness you were trying to remove.
 *
 * Returns null for anything unparseable, which is treated as "refresh".
 */
export function expiryFromClaim(exp: unknown): number | null {
  if (typeof exp !== "number" || !Number.isFinite(exp) || exp <= 0) return null;
  return exp * 1000;
}
