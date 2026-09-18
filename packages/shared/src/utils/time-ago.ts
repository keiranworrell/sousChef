/**
 * "3m ago", for notification timestamps.
 *
 * Deliberately not `Intl.RelativeTimeFormat`. Hermes on Android ships an Intl
 * implementation whose coverage varies by build, and a notification list is not
 * worth a runtime surprise on one platform — this is six comparisons and a
 * string.
 *
 * `now` is a parameter rather than a call to `Date.now()` inside, so a test can
 * state the instant it means instead of racing the clock.
 */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const diffMs = now.getTime() - then;

  // Clock skew between the device and the server can put a notification a few
  // seconds in the future. "in -2m" would be absurd; "just now" is true enough.
  if (diffMs < 60_000) return "just now";

  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;

  // Past a month the exact age stops being the point, and "9w ago" is harder to
  // read than a date. The caller has the full timestamp if it needs precision.
  const d = new Date(then);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}
