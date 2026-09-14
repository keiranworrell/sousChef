import { and, count, desc, eq, or } from "drizzle-orm";
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
/**
 * Records that the user cooked a recipe.
 *
 * Returns null if the recipe isn't one they can see. Previously this inserted
 * against any id and then read the recipe back unconditionally, returning its
 * title and image — so the endpoint could be used to enumerate recipe ids and
 * read content out of other people's private recipes. The check has to come
 * first, and the read has to carry the same constraint: fetching by id alone
 * after an ownership check elsewhere just moves the hole around.
 *
 * Own recipes and public ones both qualify — cooking something from the
 * community is the point of the community.
 */
export async function logCook(
  userId: string,
  recipeId: string,
): Promise<CookHistoryEntryWithRecipe | null> {
  const db = await getDb();

  const [recipe] = await db
    .select({ title: recipes.title, imageUrl: recipes.imageUrl })
    .from(recipes)
    .where(
      and(
        eq(recipes.id, recipeId),
        or(eq(recipes.userId, userId), eq(recipes.isPublic, true)),
      ),
    )
    .limit(1);

  if (!recipe) return null;

  const [entry] = await db
    .insert(cookHistory)
    .values({ userId, recipeId })
    .returning();

  if (!entry) throw new Error("Failed to create cook history entry");

  return {
    ...entry,
    recipe: {
      title: recipe.title,
      imageUrl: recipe.imageUrl,
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
