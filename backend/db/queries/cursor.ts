/**
 * Opaque cursor encoding for keyset pagination.
 *
 * Offset pagination duplicates and skips rows when the underlying set changes
 * mid-scroll — add a recipe while the user is paging and every subsequent page
 * shifts by one. Keyset pagination anchors each page to the sort key of the last
 * row returned, so concurrent writes can't shift the window.
 *
 * Every cursor carries the row id alongside the sort value. Sort columns are not
 * unique — two recipes can share an `updated_at` to the millisecond, and titles
 * collide freely — so the id acts as a deterministic tiebreaker. Without it, rows
 * sharing a sort value sit in an arbitrary order that Postgres is free to vary
 * between queries, which reintroduces exactly the duplicate/skip behaviour keyset
 * pagination is meant to remove.
 *
 * The encoding is base64url of JSON. It is opaque by contract: clients pass it
 * back verbatim and must not construct or interpret it.
 */

export type RecipeCursor =
  | { k: "updatedAt"; v: string; id: string }
  | { k: "title"; v: string; id: string }
  | { k: "likeCount"; v: number; id: string };

export function encodeCursor(cursor: RecipeCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

/**
 * Decodes a cursor, returning null for anything malformed.
 *
 * A bad cursor is treated as "start from the beginning" rather than an error:
 * cursors end up in shared URLs and browser history, and a stale or truncated
 * one should degrade to the first page instead of showing the user a failure.
 */
export function decodeCursor(raw: string | null | undefined): RecipeCursor | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    );
    if (typeof parsed !== "object" || parsed === null) return null;

    const c = parsed as Record<string, unknown>;
    if (typeof c["id"] !== "string") return null;

    if (c["k"] === "updatedAt" || c["k"] === "title") {
      if (typeof c["v"] !== "string") return null;
      return { k: c["k"], v: c["v"], id: c["id"] };
    }
    if (c["k"] === "likeCount") {
      if (typeof c["v"] !== "number" || !Number.isFinite(c["v"])) return null;
      return { k: "likeCount", v: c["v"], id: c["id"] };
    }
    return null;
  } catch {
    return null;
  }
}
