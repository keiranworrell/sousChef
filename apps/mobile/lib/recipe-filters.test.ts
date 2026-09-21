import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS,
  DIFFICULTY_LABELS,
  DIFFICULTY_ORDER,
  RECIPE_LIMIT_MAX,
  SORT_LABELS,
  SORT_ORDER,
  activeFilterCount,
  filtersKey,
  hasActiveFilters,
  toListParams,
  type RecipeFilters,
} from "./recipe-filters";

const withFilters = (over: Partial<RecipeFilters> = {}): RecipeFilters => ({
  ...DEFAULT_FILTERS,
  ...over,
});

describe("toListParams", () => {
  it("sends nothing but the sort for an untouched search", () => {
    expect(toListParams(withFilters())).toEqual({
      limit: 20,
      q: undefined,
      tag: undefined,
      difficulty: undefined,
      sort: "newest",
    });
  });

  it("passes the filters that are set", () => {
    expect(toListParams(withFilters({ q: "pie", tag: "baking", difficulty: "easy", sort: "title" })))
      .toEqual({ limit: 20, q: "pie", tag: "baking", difficulty: "easy", sort: "title" });
  });

  it("treats whitespace as no search", () => {
    expect(toListParams(withFilters({ q: "   " })).q).toBeUndefined();
  });

  it("trims a real search", () => {
    expect(toListParams(withFilters({ q: "  chicken pie " })).q).toBe("chicken pie");
  });

  it("never asks for more than the endpoint allows", () => {
    // The bug this module exists for: ListQuerySchema caps limit at 100 and
    // Zod rejects the whole request above it, so asking for 200 returns
    // nothing at all rather than fewer rows. The meal plan picker did exactly
    // that and looked like an empty library.
    expect(toListParams(withFilters(), 200).limit).toBe(RECIPE_LIMIT_MAX);
    expect(toListParams(withFilters(), 1000).limit).toBe(RECIPE_LIMIT_MAX);
  });

  it("leaves a limit under the cap alone", () => {
    expect(toListParams(withFilters(), 20).limit).toBe(20);
    expect(toListParams(withFilters(), 100).limit).toBe(100);
  });

  it("always sends a sort", () => {
    // "newest" is a choice, not the absence of one — dropping it would let the
    // server's default drift away from what the control shows.
    expect(toListParams(withFilters()).sort).toBe("newest");
  });
});

describe("hasActiveFilters", () => {
  it("is false for an untouched search", () => {
    expect(hasActiveFilters(withFilters())).toBe(false);
  });

  it("notices each filter", () => {
    expect(hasActiveFilters(withFilters({ q: "pie" }))).toBe(true);
    expect(hasActiveFilters(withFilters({ tag: "baking" }))).toBe(true);
    expect(hasActiveFilters(withFilters({ difficulty: "hard" }))).toBe(true);
  });

  it("does not count sorting as filtering", () => {
    // Otherwise everyone who prefers alphabetical sees a permanent "filtered"
    // marker over a list that is showing them everything.
    expect(hasActiveFilters(withFilters({ sort: "title" }))).toBe(false);
  });

  it("ignores a whitespace-only search", () => {
    expect(hasActiveFilters(withFilters({ q: "  " }))).toBe(false);
  });
});

describe("activeFilterCount", () => {
  it("counts only what narrows the list", () => {
    expect(activeFilterCount(withFilters())).toBe(0);
    expect(activeFilterCount(withFilters({ q: "pie" }))).toBe(1);
    expect(activeFilterCount(withFilters({ q: "pie", tag: "baking" }))).toBe(2);
    expect(activeFilterCount(withFilters({ q: "pie", tag: "baking", difficulty: "easy" }))).toBe(3);
    expect(activeFilterCount(withFilters({ sort: "oldest" }))).toBe(0);
  });
});

describe("filtersKey", () => {
  it("changes when the results would change", () => {
    const base = filtersKey(withFilters());
    expect(filtersKey(withFilters({ q: "pie" }))).not.toBe(base);
    expect(filtersKey(withFilters({ tag: "baking" }))).not.toBe(base);
    expect(filtersKey(withFilters({ difficulty: "easy" }))).not.toBe(base);
    // Sort changes the order, which is still a different result set to page.
    expect(filtersKey(withFilters({ sort: "title" }))).not.toBe(base);
  });

  it("is stable for the same query", () => {
    expect(filtersKey(withFilters({ q: " pie " }))).toBe(filtersKey(withFilters({ q: "pie" })));
  });
});

describe("the controls", () => {
  it("has a label for every sort and difficulty option", () => {
    expect(SORT_ORDER.map((s) => SORT_LABELS[s])).toEqual(["Newest", "Oldest", "A–Z"]);
    expect(DIFFICULTY_ORDER.map((d) => DIFFICULTY_LABELS[d])).toEqual(["Easy", "Medium", "Hard"]);
  });

  it("offers every value the endpoint accepts", () => {
    // ListQuerySchema enumerates exactly these; anything else is a 400.
    expect([...SORT_ORDER].sort()).toEqual(["newest", "oldest", "title"]);
    expect([...DIFFICULTY_ORDER].sort()).toEqual(["easy", "hard", "medium"]);
  });
});
