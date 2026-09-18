/**
 * Display helpers for the multi-recipe cook screen.
 *
 * Both of these are read at arm's length with wet hands, so the wording and the
 * colour assignment matter more than they look like they should.
 */

/**
 * A step's position in the cook, as a phrase rather than a clock time.
 *
 * Offsets are advisory — the planner has no idea how fast this person works —
 * so the copy stays approximate. An actual time ("19:42") would imply the plan
 * knows when the cook started and how it has gone, and it does not.
 */
export function formatOffset(minutes: number): string {
  // Negative is not meaningful but is reachable from a malformed plan. Treating
  // it as the start is more useful than rendering "~-5 min in".
  if (minutes <= 0) return "Start now";
  if (minutes < 60) return `~${minutes} min in`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `~${hours} hr in` : `~${hours} hr ${rest} min in`;
}

/**
 * Colour per recipe, so a glance tells you which pan a step belongs to.
 *
 * Always paired with the recipe's name on screen, never replacing it: colour
 * alone is useless to anyone who cannot distinguish these, and "which dish is
 * this" is the one question this screen must always answer.
 */
export const RECIPE_COLOURS = [
  "#fb923c",
  "#38bdf8",
  "#34d399",
  "#a78bfa",
  "#fb7185",
] as const;

/**
 * A stable colour for a recipe within one session.
 *
 * Indexed by the recipe's position in the session's own list rather than by
 * step order, so a recipe keeps its colour from its first step to its last.
 * Falls back to the first colour for a step whose recipe is not in the list —
 * reachable if a plan outlives an edit — rather than rendering `undefined` as a
 * style.
 */
export function recipeColour(recipeIds: readonly string[], recipeId: string): string {
  const index = recipeIds.indexOf(recipeId);
  if (index < 0) return RECIPE_COLOURS[0];
  return RECIPE_COLOURS[index % RECIPE_COLOURS.length]!;
}
