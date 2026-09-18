/**
 * The display hostname for a recipe's source URL.
 *
 * This is deliberately a regex rather than `new URL(url).hostname`, which is
 * what the web component used to do. React Native ships a partial URL
 * implementation: `new URL()` exists, so the call does not throw and a
 * try/catch does not save you, but the parsed parts are unreliable and
 * `hostname` can come back empty. Attribution that silently disappears on one
 * platform is worse than no attribution at all, because nobody notices it is
 * gone.
 *
 * Sharing one implementation also means web and mobile credit the same recipe
 * the same way. Two parsers would be free to disagree about, say, a URL with a
 * port or a trailing dot, and the bug would only show on whichever platform the
 * reporter happened to be using.
 */

/**
 * scheme, optional userinfo, then the host up to the first /?# or :port.
 * Anchored, so a string that merely contains a URL does not match.
 */
const URL_RE = /^[a-z][a-z0-9+.-]*:\/\/(?:[^/?#@]*@)?([^/?#:]+)/i;

/**
 * Hostname without a `www.` prefix, or null if the URL will not parse.
 *
 * Returning null rather than a best guess matters: the caller renders nothing
 * for null, and a wrong credit is worse than an absent one.
 */
export function hostnameOf(url: string | null): string | null {
  if (!url) return null;

  const match = URL_RE.exec(url.trim());
  if (!match) return null;

  const host = match[1]!
    .toLowerCase()
    // A trailing dot is the DNS root and is legal in a URL. It is never
    // something a reader wants to see in "Imported from bbc.co.uk.".
    .replace(/\.$/, "")
    .replace(/^www\./, "");

  // A host with no dot is not something we want to credit — it is a bare
  // hostname on a private network, or the leftovers of a malformed string.
  if (!host || !host.includes(".")) return null;

  return host;
}
