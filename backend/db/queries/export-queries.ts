import { eq, inArray, or } from "drizzle-orm";
import { getDb } from "../client";
import {
  users,
  recipes,
  recipeIngredients,
  recipeSteps,
  recipeTags,
  collections,
  collectionItems,
  pantryItems,
  pantryItemNotes,
  shoppingLists,
  shoppingListItems,
  mealPlans,
  mealPlanEntries,
  fermentationBatches,
  fermentationLogs,
  cookHistory,
  follows,
  recipeLikes,
  notifications,
  householdMembers,
} from "../schema";

/**
 * Full export of everything the service holds about one user, for the UK GDPR
 * right of access (Article 15) and right to data portability (Article 20).
 *
 * Portability requires a "structured, commonly used and machine-readable"
 * format, which is why this is plain JSON rather than a rendered document.
 *
 * Completeness is the whole point: an export that quietly omits a table doesn't
 * satisfy the right. Every table carrying a foreign key to `users` is covered
 * here. If a new table is added, it must be added to this export too — that
 * obligation is easy to forget, so it is called out in the users Lambda where
 * the route lives, and asserted by the accompanying test.
 */
export type UserDataExport = {
  exportedAt: string;
  format: string;
  account: Record<string, unknown>;
  recipes: unknown[];
  collections: unknown[];
  pantry: unknown[];
  shoppingLists: unknown[];
  mealPlans: unknown[];
  fermentationBatches: unknown[];
  cookHistory: unknown[];
  social: {
    following: unknown[];
    followers: unknown[];
    likedRecipes: unknown[];
  };
  households: unknown[];
  notifications: unknown[];
};

export async function exportUserData(userId: string): Promise<UserDataExport> {
  const db = await getDb();

  const [account] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!account) throw new Error("User not found");

  // ── Recipes, with their nested children ────────────────────────────────────
  const recipeRows = await db.select().from(recipes).where(eq(recipes.userId, userId));
  const recipeIds = recipeRows.map((r) => r.id);

  const [ingredients, steps, tags] = recipeIds.length
    ? await Promise.all([
        db.select().from(recipeIngredients).where(inArray(recipeIngredients.recipeId, recipeIds)),
        db.select().from(recipeSteps).where(inArray(recipeSteps.recipeId, recipeIds)),
        db.select().from(recipeTags).where(inArray(recipeTags.recipeId, recipeIds)),
      ])
    : [[], [], []];

  const byRecipe = <T extends { recipeId: string }>(rows: T[]): Map<string, T[]> => {
    const m = new Map<string, T[]>();
    for (const row of rows) {
      const existing = m.get(row.recipeId) ?? [];
      existing.push(row);
      m.set(row.recipeId, existing);
    }
    return m;
  };
  const ingredientsBy = byRecipe(ingredients);
  const stepsBy = byRecipe(steps);
  const tagsBy = byRecipe(tags);

  const exportedRecipes = recipeRows.map((r) => ({
    ...r,
    ingredients: ingredientsBy.get(r.id) ?? [],
    steps: stepsBy.get(r.id) ?? [],
    tags: (tagsBy.get(r.id) ?? []).map((t) => t.tag),
  }));

  // ── Collections, with membership ───────────────────────────────────────────
  const collectionRows = await db.select().from(collections).where(eq(collections.userId, userId));
  const collectionIds = collectionRows.map((c) => c.id);
  const items = collectionIds.length
    ? await db.select().from(collectionItems).where(inArray(collectionItems.collectionId, collectionIds))
    : [];
  const exportedCollections = collectionRows.map((c) => ({
    ...c,
    recipeIds: items.filter((i) => i.collectionId === c.id).map((i) => i.recipeId),
  }));

  // ── Pantry, with notes ─────────────────────────────────────────────────────
  const pantryRows = await db.select().from(pantryItems).where(eq(pantryItems.userId, userId));
  const pantryIds = pantryRows.map((p) => p.id);
  const notes = pantryIds.length
    ? await db.select().from(pantryItemNotes).where(inArray(pantryItemNotes.pantryItemId, pantryIds))
    : [];
  const exportedPantry = pantryRows.map((p) => ({
    ...p,
    notes: notes.filter((n) => n.pantryItemId === p.id),
  }));

  // ── Shopping lists, with items ─────────────────────────────────────────────
  const listRows = await db.select().from(shoppingLists).where(eq(shoppingLists.userId, userId));
  const listIds = listRows.map((l) => l.id);
  const listItems = listIds.length
    ? await db.select().from(shoppingListItems).where(inArray(shoppingListItems.shoppingListId, listIds))
    : [];
  const exportedLists = listRows.map((l) => ({
    ...l,
    items: listItems.filter((i) => i.shoppingListId === l.id),
  }));

  // ── Meal plans, with entries ───────────────────────────────────────────────
  const planRows = await db.select().from(mealPlans).where(eq(mealPlans.userId, userId));
  const planIds = planRows.map((p) => p.id);
  const planEntries = planIds.length
    ? await db.select().from(mealPlanEntries).where(inArray(mealPlanEntries.mealPlanId, planIds))
    : [];
  const exportedPlans = planRows.map((p) => ({
    ...p,
    entries: planEntries.filter((e) => e.mealPlanId === p.id),
  }));

  // ── Fermentation batches, with their logs ──────────────────────────────────
  const batchRows = await db
    .select()
    .from(fermentationBatches)
    .where(eq(fermentationBatches.userId, userId));
  const batchIds = batchRows.map((b) => b.id);
  const logs = batchIds.length
    ? await db.select().from(fermentationLogs).where(inArray(fermentationLogs.batchId, batchIds))
    : [];
  const exportedBatches = batchRows.map((b) => ({
    ...b,
    logs: logs.filter((l) => l.batchId === b.id),
  }));

  // ── Everything else ────────────────────────────────────────────────────────
  const [
    cookHistoryRows,
    followRows,
    likeRows,
    notificationRows,
    householdRows,
  ] = await Promise.all([
    db.select().from(cookHistory).where(eq(cookHistory.userId, userId)),
    // Both directions: who the user follows, and who follows them. Both are
    // personal data about this user and both are within the access right.
    db
      .select()
      .from(follows)
      .where(or(eq(follows.followerId, userId), eq(follows.followeeId, userId))),
    db.select().from(recipeLikes).where(eq(recipeLikes.userId, userId)),
    db.select().from(notifications).where(eq(notifications.userId, userId)),
    db.select().from(householdMembers).where(eq(householdMembers.userId, userId)),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    format: "souschef-export-v1",
    account,
    recipes: exportedRecipes,
    collections: exportedCollections,
    pantry: exportedPantry,
    shoppingLists: exportedLists,
    mealPlans: exportedPlans,
    fermentationBatches: exportedBatches,
    cookHistory: cookHistoryRows,
    social: {
      following: followRows.filter((f) => f.followerId === userId),
      followers: followRows.filter((f) => f.followeeId === userId),
      likedRecipes: likeRows,
    },
    households: householdRows,
    notifications: notificationRows,
  };
}
