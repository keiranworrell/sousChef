import { describe, expect, it } from "vitest";
import { deriveOnboardingState } from "./onboarding-queries";

const NONE = { recipes: 0, mealPlans: 0, shoppingLists: 0, cooks: 0 };
const ALL = { recipes: 3, mealPlans: 1, shoppingLists: 2, cooks: 5 };

describe("deriveOnboardingState", () => {
  it("returns the four core-loop steps in order", () => {
    expect(deriveOnboardingState(NONE).steps.map((s) => s.id)).toEqual([
      "add-recipe",
      "plan-meals",
      "shopping-list",
      "cook",
    ]);
  });

  it("is incomplete until every step is done", () => {
    expect(deriveOnboardingState(NONE).complete).toBe(false);
    expect(deriveOnboardingState({ ...NONE, recipes: 1 }).complete).toBe(false);
    expect(deriveOnboardingState(ALL).complete).toBe(true);
  });

  it("treats 'fresh' as having no recipes, not as having nothing at all", () => {
    // This is what decides whether someone gets a welcome modal. A user with a
    // library but no meal plan is partway through, not new, and greeting them
    // would be wrong.
    expect(deriveOnboardingState(NONE).fresh).toBe(true);
    expect(deriveOnboardingState({ ...NONE, recipes: 1 }).fresh).toBe(false);
    expect(deriveOnboardingState(ALL).fresh).toBe(false);
  });

  it("marks each step from its own count", () => {
    const state = deriveOnboardingState({ ...NONE, shoppingLists: 1 });
    const done = state.steps.filter((s) => s.done).map((s) => s.id);
    expect(done).toEqual(["shopping-list"]);
  });
});
