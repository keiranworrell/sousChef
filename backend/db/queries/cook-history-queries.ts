import { count, desc, eq } from "drizzle-orm";
import { getDb } from "../client";
import { cookHistory, recipes } from "../schema";

export type CookHistoryRecord = typeof cookHistory.$inferSelect;

export type CookHistoryEntryWithRecipe = CookHistoryRecord & {
  recipe: {
    title: string;
    imageUrl: string | null;
  };
};

export type GetCookHistoryOptions = {
  limit: number;
  offset: number;
};

/**
 * Log a cook session for a user and recipe.
 * Returns the newly created cook history entry with recipe details.
 */
export async function logCook(
  userId: string,
  recipeId: string,
): Promise<CookHistoryEntryWithRecipe> {
  const db = await getDb();

  const [entry] = await db
    .insert(cookHistory)
    .values({ userId, recipeId })
    .returning();

  if (!entry) throw new Error("Failed to create cook history entry");

  // Fetch the recipe title and image to return alongside the entry
  const [recipe] = await db
    .select({ title: recipes.title, imageUrl: recipes.imageUrl })
    .from(recipes)
    .where(eq(recipes.id, recipeId))
    .limit(1);

  return {
    ...entry,
    recipe: {
      title: recipe?.title ?? "",
      imageUrl: recipe?.imageUrl ?? null,
    },
  };
}

/**
 * Return a paginated cook history for a user, most recent first.
 * Each entry includes the recipe title and image.
 */
export async function getCookHistory(
  userId: string,
  options: GetCookHistoryOptions,
): Promise<{
  entries: CookHistoryEntryWithRecipe[];
  total: number;
  limit: number;
  offset: number;
}> {
  const db = await getDb();
  const { limit, offset } = options;

  const [totalRow] = await db
    .select({ value: count() })
    .from(cookHistory)
    .where(eq(cookHistory.userId, userId));

  const rows = await db
    .select({
      id: cookHistory.id,
      userId: cookHistory.userId,
      recipeId: cookHistory.recipeId,
      cookedAt: cookHistory.cookedAt,
      recipeTitle: recipes.title,
      recipeImageUrl: recipes.imageUrl,
    })
    .from(cookHistory)
    .innerJoin(recipes, eq(cookHistory.recipeId, recipes.id))
    .where(eq(cookHistory.userId, userId))
    .orderBy(desc(cookHistory.cookedAt))
    .limit(limit)
    .offset(offset);

  const entries: CookHistoryEntryWithRecipe[] = rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    recipeId: row.recipeId,
    cookedAt: row.cookedAt,
    recipe: {
      title: row.recipeTitle,
      imageUrl: row.recipeImageUrl,
    },
  }));

  return {
    entries,
    total: totalRow?.value ?? 0,
    limit,
    offset,
  };
}
