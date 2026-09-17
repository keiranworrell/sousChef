import { eq, sql } from "drizzle-orm";
import { getDb } from "../client";
import { cookHistory, mealPlans, recipes, shoppingLists } from "../schema";

/**
 * Onboarding progress, derived from what the user has actually done.
 *
 * Deliberately not a column. A flag records that someone clicked "done", which
 * is a different claim from being set up — it cannot tell a user who imported
 * twenty recipes from one who dismissed a modal, and those two want opposite
 * things from the app. Counting real rows means the checklist is true on every
 * device without anything to keep in sync, and it costs no migration.
 *
 * The steps follow the product's core loop rather than its feature list: get a
 * recipe in, plan a week, shop for it, cook it. A checklist of everything the
 * app can do would be a menu, not an onboarding.
 */

export type OnboardingCounts = {
  recipes: number;
  mealPlans: number;
  shoppingLists: number;
  cooks: number;
};

export type OnboardingStep = {
  id: "add-recipe" | "plan-meals" | "shopping-list" | "cook";
  done: boolean;
};

export type OnboardingState = {
  steps: OnboardingStep[];
  /** True once every step is done — the point at which the UI stops nagging. */
  complete: boolean;
  /** True when the user has nothing at all, so the welcome is worth showing. */
  fresh: boolean;
};

/**
 * Pure: turns counts into the checklist.
 *
 * Separated from the query so the ordering and the completion rule can be
 * tested without a database. Exported for that reason only.
 */
export function deriveOnboardingState(counts: OnboardingCounts): OnboardingState {
  const steps: OnboardingStep[] = [
    { id: "add-recipe", done: counts.recipes > 0 },
    { id: "plan-meals", done: counts.mealPlans > 0 },
    { id: "shopping-list", done: counts.shoppingLists > 0 },
    { id: "cook", done: counts.cooks > 0 },
  ];

  return {
    steps,
    complete: steps.every((s) => s.done),
    // "Fresh" is about the recipes specifically, not about every count being
    // zero. Someone who has recipes but has never planned a week is a returning
    // user partway through, and showing them a welcome modal would be wrong.
    fresh: counts.recipes === 0,
  };
}

export async function getOnboardingState(userId: string): Promise<OnboardingState> {
  const db = await getDb();

  // Four counts in parallel. Each is an index-backed count on a user_id column,
  // and `exists`-style limits are not worth the complexity here — this runs once
  // per page load on an account with, by definition, very little in it.
  const [recipeRows, mealPlanRows, shoppingRows, cookRows] = await Promise.all([
    db
      .select({ value: sql<number>`count(*)`.mapWith(Number) })
      .from(recipes)
      .where(eq(recipes.userId, userId)),
    db
      .select({ value: sql<number>`count(*)`.mapWith(Number) })
      .from(mealPlans)
      .where(eq(mealPlans.userId, userId)),
    db
      .select({ value: sql<number>`count(*)`.mapWith(Number) })
      .from(shoppingLists)
      .where(eq(shoppingLists.userId, userId)),
    db
      .select({ value: sql<number>`count(*)`.mapWith(Number) })
      .from(cookHistory)
      .where(eq(cookHistory.userId, userId)),
  ]);

  return deriveOnboardingState({
    recipes: recipeRows[0]?.value ?? 0,
    mealPlans: mealPlanRows[0]?.value ?? 0,
    shoppingLists: shoppingRows[0]?.value ?? 0,
    cooks: cookRows[0]?.value ?? 0,
  });
}
