/**
 * Which collection path a request is actually for.
 *
 * This exists because the same mistake has now been made twice in this one
 * handler. The branches are ordered `if`s over `rawPath`, and a branch written
 * as "has an id, and isn't one of the sub-resources I can currently think of"
 * silently swallows every sub-resource added after it.
 *
 * The first time it was `/collections/for-recipe/{recipeId}` (PR #126). The
 * second was `/collections/{id}/shares`: the generic branch asked only
 * `!rawPath.includes("/recipes")`, so a request for the shares of a collection
 * matched it and came back as the collection. The client then read
 * `res.data.shares` off a collection, got `undefined`, and crashed the app on
 * `shares.map`.
 *
 * An exclusion list has to be updated every time a sub-resource is added, and
 * nothing fails when it isn't — the route just quietly starts returning the
 * wrong thing with a 200. So this is a positive match instead: the bare path
 * is the one that ends with the id and nothing more.
 */

/**
 * True only for `/collections/{id}` with no sub-resource after it.
 *
 * Matched on the path's last two segments rather than its suffix. Suffix
 * matching looks equivalent and is not: `/collections/{id}/shares/{shareId}`
 * also ends with an id, so it would match whenever a share's id happened to
 * equal its collection's. Two UUIDs colliding is vanishingly unlikely, but
 * "vanishingly unlikely" is a poor thing to build routing on when the correct
 * check is no harder.
 *
 * Tolerates a stage prefix (`/prod/collections/{id}`) and a trailing slash,
 * because `rawPath` carries both depending on how the gateway is reached.
 */
export function isBareCollectionPath(
  rawPath: string,
  collectionId: string | undefined,
): boolean {
  if (!collectionId) return false;

  const segments = rawPath.split("/").filter(Boolean);
  if (segments.length < 2) return false;

  return (
    segments[segments.length - 1] === collectionId &&
    segments[segments.length - 2] === "collections"
  );
}
