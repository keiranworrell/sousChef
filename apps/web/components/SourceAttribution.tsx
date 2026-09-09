import React from "react";

type Props = {
  sourceUrl: string | null;
  /** True once the user has edited a recipe that came from an external source. */
  sourceModified?: boolean;
  className?: string;
};

/**
 * Credits where a recipe came from.
 *
 * This is a copyright matter as much as a UX one: a recipe lifted from someone
 * else's site should say so, and link back. It's shown wherever a recipe is
 * displayed, including on public pages where the reader isn't the importer.
 *
 * "Imported from" and "Adapted from" are meaningfully different claims. Adapted
 * says the content has diverged from the original, so a reader shouldn't hold
 * the source responsible for what they're reading. Understating adaptation is
 * the safer error, so the flag only turns on when content genuinely changed.
 */
export default function SourceAttribution({
  sourceUrl,
  sourceModified = false,
  className = "",
}: Props): React.JSX.Element | null {
  if (!sourceUrl) return null;

  const hostname = safeHostname(sourceUrl);
  if (!hostname) return null;

  return (
    <a
      href={sourceUrl}
      target="_blank"
      // noreferrer alongside noopener: don't leak our URL to the source site
      rel="noopener noreferrer nofollow"
      className={`inline-flex items-center gap-1 text-xs text-gray-400 transition-colors hover:text-orange-500 hover:underline ${className}`}
    >
      <span>{sourceModified ? "Adapted from" : "Imported from"}</span>
      <span className="font-medium">{hostname}</span>
      <span aria-hidden>↗</span>
    </a>
  );
}

/**
 * Hostname without the www prefix, or null if the URL won't parse.
 *
 * sourceUrl reaches us from imported pages and from the database, so it isn't
 * guaranteed well-formed. `new URL()` throws on bad input, and this renders
 * inside a page — an exception here would blank the whole recipe rather than
 * just omit a credit line.
 */
function safeHostname(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
