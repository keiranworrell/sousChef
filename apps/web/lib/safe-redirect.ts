/**
 * Sanitises a post-authentication redirect target.
 *
 * The `next` parameter arrives from the query string, so it is attacker
 * controllable: anyone can send a user a link to
 * `/sign-in?next=https://evil.example/login`. If that value were passed
 * straight to `router.push`, the victim would sign in on the real site and
 * then be handed to a page of the attacker's choosing — one that can convincingly
 * imitate sousChef and ask them to "confirm" their password. That is a classic
 * open redirect, and it is worth being strict rather than clever here.
 *
 * Only same-origin, path-absolute URLs are accepted. Everything else falls back
 * to the caller's default.
 */

/** Where users land after signing in when there's no valid target. */
export const DEFAULT_POST_AUTH_ROUTE = "/recipes";

/**
 * Paths that must never be a post-auth destination, because landing on one
 * either bounces the user straight back out or is simply useless.
 */
const DISALLOWED_PREFIXES = ["/sign-in", "/sign-up", "/confirm"];

export function sanitiseRedirect(
  raw: string | null | undefined,
  fallback: string = DEFAULT_POST_AUTH_ROUTE,
): string {
  if (!raw) return fallback;

  // Must be path-absolute. This rejects "https://evil.example", "//evil.example"
  // (protocol-relative, which browsers treat as absolute), and any bare
  // "evil.example" that would resolve relative to the current route.
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//")) return fallback;

  // Backslashes are normalised to forward slashes by several browsers, so
  // "/\evil.example" and "/\/evil.example" can escape the origin. Reject any.
  if (raw.includes("\\")) return fallback;

  // Control characters can be used to split or smuggle past naive checks.
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(raw)) return fallback;

  // Parse against a throwaway origin to confirm it stays put once resolved.
  // A value like "/..%2F..%2Fevil" or one containing an embedded scheme will
  // reveal itself here rather than at navigation time.
  let parsed: URL;
  try {
    parsed = new URL(raw, "https://souschef.invalid");
  } catch {
    return fallback;
  }
  if (parsed.origin !== "https://souschef.invalid") return fallback;

  const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;

  // Don't send the user back to an auth page — they'd be redirected straight
  // out again, which reads as the sign-in silently failing.
  if (DISALLOWED_PREFIXES.some((p) => parsed.pathname === p || parsed.pathname.startsWith(`${p}/`))) {
    return fallback;
  }

  return path;
}
