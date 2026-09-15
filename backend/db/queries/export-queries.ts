import { eq, inArray, or } from "drizzle-orm";
import type { InterchangeRecipe } from "@souschef/shared";
import { RECIPE_INTERCHANGE_FORMAT, USER_EXPORT_FORMAT } from "@souschef/shared";
import { getDb } from "../client";
import {
  users,
  recipes,
  recipeIngredients,
  recipeSteps,
  recipeTags,
  collections,
  collectionItems,
  collectionShares,
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
 * The `recipes` array is emitted in the souschef-recipe-v1 interchange format
 * rather than as raw table rows, so the file this produces is one the importer
 * accepts. Portability means the data can go somewhere, and a dump of our
 * primary keys that not even we can read back does not meet that bar. Nothing
 * is lost in the reshaping: internal ids and the owning user id are the only
 * fields dropped, and neither is personal data about the user beyond what the
 * `account` block already states.
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
  /**
   * The format of the `recipes` array specifically, so a reader can tell what
   * the recipes conform to without inferring it from the wrapper version.
   */
  recipeFormat: string;
  account: Record<string, unknown>;
  recipes: InterchangeRecipe[];
  collections: unknown[];
  /**
   * Collection access this user granted or was granted. Both directions, like
   * `social` below: a row naming them as recipient is personal data concerning
   * them, and a row they created is a record of their own activity.
   */
  collectionShares: {
    granted: unknown[];
    received: unknown[];
  };
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

  // Sorted by the stored index, then flattened to array position — the
  // interchange format carries order by position and nothing else, so the sort
  // has to happen here rather than being left to whatever order the rows came
  // back in.
  const exportedRecipes: InterchangeRecipe[] = recipeRows.map((r) => ({
    title: r.title,
    description: r.description,
    imageUrl: r.imageUrl,
    servings: r.servings,
    prepTimeMinutes: r.prepTimeMinutes,
    cookTimeMinutes: r.cookTimeMinutes,
    difficulty: r.difficulty,
    cuisine: r.cuisine,
    sourceUrl: r.sourceUrl,
    sourceModified: r.sourceModified,
    tags: (tagsBy.get(r.id) ?? []).map((t) => t.tag),
    ingredients: (ingredientsBy.get(r.id) ?? [])
      .slice()
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        notes: i.notes,
      })),
    steps: (stepsBy.get(r.id) ?? [])
      .slice()
      .sort((a, b) => a.stepNumber - b.stepNumber)
      .map((s) => ({
        instruction: s.instruction,
        timerSeconds: s.timerSeconds,
        imageUrl: s.imageUrl,
      })),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  // Collections reference recipes, and the interchange format has no ids to
  // reference. Title is what survives a round trip, so that is what the
  // collection membership is expressed in.
  const recipeTitleById = new Map(recipeRows.map((r) => [r.id, r.title]));

  // ── Collections, with membership ───────────────────────────────────────────
  const collectionRows = await db.select().from(collections).where(eq(collections.userId, userId));
  const collectionIds = collectionRows.map((c) => c.id);
  const items = collectionIds.length
    ? await db.select().from(collectionItems).where(inArray(collectionItems.collectionId, collectionIds))
    : [];
  const exportedCollections = collectionRows.map((c) => ({
    ...c,
    recipeIds: items.filter((i) => i.collectionId === c.id).map((i) => i.recipeId),
    // Titles as well as ids. The ids are meaningful only inside this account,
    // and the recipes array no longer carries them, so a reader with the file
    // alone could not otherwise tell what is in a collection.
    recipeTitles: items
      .filter((i) => i.collectionId === c.id)
      .map((i) => recipeTitleById.get(i.recipeId) ?? null),
  }));

  // ── Collection shares, both directions ─────────────────────────────────────
  //
  // Household shares are not included here. Those rows reference a household
  // rather than this user, so they are not personal data about them in the way
  // a named grant is — and the household membership that confers the access is
  // already exported under `households`.
  const shareRows = await db
    .select()
    .from(collectionShares)
    .where(
      or(
        eq(collectionShares.createdBy, userId),
        eq(collectionShares.sharedWithUserId, userId),
      ),
    );

  // Collection names alongside the ids, for the same reason the recipes array
  // carries titles: an id is meaningless to anyone reading the file on its own.
  const collectionNameById = new Map(collectionRows.map((c) => [c.id, c.name]));
  const withNames = (rows: typeof shareRows): unknown[] =>
    rows.map((r) => ({
      ...r,
      collectionName: collectionNameById.get(r.collectionId) ?? null,
    }));

  const exportedShares = {
    granted: withNames(shareRows.filter((r) => r.createdBy === userId)),
    received: withNames(shareRows.filter((r) => r.sharedWithUserId === userId)),
  };

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
    format: USER_EXPORT_FORMAT,
    recipeFormat: RECIPE_INTERCHANGE_FORMAT,
    account,
    recipes: exportedRecipes,
    collections: exportedCollections,
    collectionShares: exportedShares,
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
