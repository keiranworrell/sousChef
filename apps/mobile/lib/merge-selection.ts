/**
 * Picking which shopping list lines are really the same thing.
 *
 * The normaliser already merges what it can be confident about — "salt" and
 * "salt, a sprinkle" — so what reaches a person is the long tail it could not
 * safely join: "spring onions" and "scallions", "tin of tomatoes" and "chopped
 * tomatoes". Only a person can say those are one item, which is why this is
 * manual at all.
 */

export type MergeCandidate = { id: string; name: string };

export type MergeSelection = {
  ids: string[];
  /** The name the merged line will keep. Always editable by the user. */
  name: string;
};

export const EMPTY_SELECTION: MergeSelection = { ids: [], name: "" };

/**
 * Add or remove one item, and keep the surviving name sensible.
 *
 * The name rules, in order:
 *  - nothing selected → no name
 *  - first item picked → its name, so the merge button is usable immediately.
 *    Without a default it stays disabled until the user notices the field,
 *    which reads as the feature being broken.
 *  - deselecting the item whose name was in use → fall back to one still
 *    selected, rather than leaving a name belonging to a line that is no
 *    longer part of the merge
 *  - otherwise → leave it alone, including anything the user typed
 */
export function toggleMergeSelection(
  selection: MergeSelection,
  item: MergeCandidate,
  /** Every candidate, needed to recover a name after a deselection. */
  all: readonly MergeCandidate[],
): MergeSelection {
  const wasSelected = selection.ids.includes(item.id);
  const ids = wasSelected
    ? selection.ids.filter((id) => id !== item.id)
    : [...selection.ids, item.id];

  if (ids.length === 0) return EMPTY_SELECTION;

  if (selection.ids.length === 0) return { ids, name: item.name };

  if (wasSelected && selection.name === item.name) {
    const fallback = all.find((c) => ids.includes(c.id));
    return { ids, name: fallback?.name ?? "" };
  }

  return { ids, name: selection.name };
}

/** The server needs two or more lines and something to call the result. */
export function canMerge(selection: MergeSelection): boolean {
  return selection.ids.length >= 2 && selection.name.trim().length > 0;
}
