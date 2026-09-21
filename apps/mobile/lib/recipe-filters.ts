/**
 * The recipe list's search and filter state.
 *
 * Kept out of the screen because two things here are easy to get wrong and
 * invisible when you do: which values mean "no filter", and the request cap.
 */

export type RecipeSort = "newest" | "oldest" | "title";
export type RecipeDifficulty = "easy" | "medium" | "hard";

export type RecipeFilters = {
  /** Free text. Searches title, ingredients and cuisine server-side. */
  q: string;
  /** A single tag, or "" for any. */
  tag: string;
  /** A difficulty, or "" for any. */
  difficulty: RecipeDifficulty | "";
  sort: RecipeSort;
};

export const DEFAULT_FILTERS: RecipeFilters = {
  q: "",
  tag: "",
  difficulty: "",
  sort: "newest",
};

/**
 * The endpoint's ceiling on `limit`.
 *
 * `ListQuerySchema` in `backend/functions/recipes.ts` declares
 * `.max(100)`, and Zod rejects the whole request above it rather than
 * clamping — so asking for more does not return fewer results, it returns
 * none. The meal plan picker asked for 200 and 400'd on every call, which
 * looked exactly like an empty recipe library.
 */
export const RECIPE_LIMIT_MAX = 100;

/**
 * Filters as query parameters.
 *
 * Empty strings become `undefined` rather than being sent through. The API
 * client only skips a parameter when it is falsy, so this mostly guards the
 * intent — but `sort` is always sent, because "newest" is a real choice and
 * not the absence of one.
 */
export function toListParams(filters: RecipeFilters, limit = 20): {
  limit: number;
  q?: string;
  tag?: string;
  difficulty?: RecipeDifficulty;
  sort: RecipeSort;
} {
  const trimmed = filters.q.trim();
  return {
    limit: Math.min(limit, RECIPE_LIMIT_MAX),
    q: trimmed || undefined,
    tag: filters.tag || undefined,
    difficulty: filters.difficulty || undefined,
    sort: filters.sort,
  };
}

/**
 * Whether anything is narrowing the list.
 *
 * Sort is excluded on purpose: reordering is not filtering, and counting it
 * would light up the "filters active" marker for every user who prefers
 * alphabetical.
 */
export function hasActiveFilters(filters: RecipeFilters): boolean {
  return filters.q.trim() !== "" || filters.tag !== "" || filters.difficulty !== "";
}

/** How many filters are on, for the badge on the search button. */
export function activeFilterCount(filters: RecipeFilters): number {
  return [filters.q.trim() !== "", filters.tag !== "", filters.difficulty !== ""]
    .filter(Boolean).length;
}

/**
 * A key that changes whenever the results would change.
 *
 * Used to reset paging: keeping a cursor from the previous query would append
 * the next page of the *old* search onto the new one.
 */
export function filtersKey(filters: RecipeFilters): string {
  return `${filters.sort}|${filters.q.trim()}|${filters.tag}|${filters.difficulty}`;
}

export const SORT_LABELS: Record<RecipeSort, string> = {
  newest: "Newest",
  oldest: "Oldest",
  title: "A–Z",
};

export const SORT_ORDER: RecipeSort[] = ["newest", "oldest", "title"];

export const DIFFICULTY_LABELS: Record<RecipeDifficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export const DIFFICULTY_ORDER: RecipeDifficulty[] = ["easy", "medium", "hard"];
