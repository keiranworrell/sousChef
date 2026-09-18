/**
 * Working out which collections actually changed when a recipe's membership is
 * edited.
 *
 * `updateRecipes` is per-collection, so ticking three boxes could mean three
 * requests — or none, if the user opened the picker and changed their mind.
 * Sending a call for every collection on screen would be wasteful and, worse,
 * would write to collections the user never touched.
 */

export type MembershipChange = {
  collectionId: string;
  /** Recipe ids to add. Always zero or one here — this is one recipe. */
  add: string[];
  remove: string[];
};

/**
 * The calls needed to move `recipeId` from `before` to `after`.
 *
 * Returns an empty array when nothing changed, which the caller should treat as
 * "close the picker" rather than "save nothing" — they are the same outcome and
 * the distinction only matters for whether a spinner appears.
 */
export function membershipChanges(
  recipeId: string,
  before: readonly string[],
  after: readonly string[],
): MembershipChange[] {
  const wasIn = new Set(before);
  const nowIn = new Set(after);

  const changes: MembershipChange[] = [];

  for (const collectionId of nowIn) {
    if (!wasIn.has(collectionId)) {
      changes.push({ collectionId, add: [recipeId], remove: [] });
    }
  }

  for (const collectionId of wasIn) {
    if (!nowIn.has(collectionId)) {
      changes.push({ collectionId, add: [], remove: [recipeId] });
    }
  }

  return changes;
}
