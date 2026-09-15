import { and, count, desc, eq, or } from "drizzle-orm";
import { getDb } from "../client";
import { cookHistory, recipes } from "../schema";
import { isRecipeInSharedCollection } from "./collection-share-queries";

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

export type LogCookInput = {
  /** 1–5. Omitted for a bare "I cooked this" log. */
  rating?: number | null;
  notes?: string | null;
  /** When it was cooked. Defaults to now. */
  cookedAt?: string | null;
};

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
 * Own recipes, public ones, and anything in a collection shared with the user
 * all qualify — cooking from the community, or from a collection a friend
 * shared, is the point of both features.
 *
 * This must stay the same set getRecipeById allows. A recipe you can open and
 * cook from but cannot log is a dead end the user will read as a bug, and they
 * would be right.
 */
export async function logCook(
  userId: string,
  recipeId: string,
  input: LogCookInput = {},
): Promise<CookHistoryEntryWithRecipe | null> {
  const db = await getDb();

  let [recipe] = await db
    .select({ title: recipes.title, imageUrl: recipes.imageUrl })
    .from(recipes)
    .where(
      and(
        eq(recipes.id, recipeId),
        or(eq(recipes.userId, userId), eq(recipes.isPublic, true)),
      ),
    )
    .limit(1);

  if (!recipe) {
    // Neither owned nor public. The remaining legitimate route is a collection
    // shared with this user; anything else stays a null, which the caller turns
    // into a 404.
    const viaShare = await isRecipeInSharedCollection(recipeId, userId);
    if (!viaShare) return null;

    [recipe] = await db
      .select({ title: recipes.title, imageUrl: recipes.imageUrl })
      .from(recipes)
      .where(eq(recipes.id, recipeId))
      .limit(1);
    if (!recipe) return null;
  }

  // An empty notes box means "nothing to say", which is the same state as never
  // having opened the form. Storing "" would make the expand affordance appear
  // on a row with nothing behind it.
  const notes = input.notes?.trim();

  const [entry] = await db
    .insert(cookHistory)
    .values({
      userId,
      recipeId,
      rating: input.rating ?? null,
      notes: notes ? notes : null,
      // Only override the column default when a date was actually supplied —
      // passing undefined lets defaultNow() do its job.
      ...(input.cookedAt ? { cookedAt: new Date(input.cookedAt) } : {}),
    })
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
      rating: cookHistory.rating,
      notes: cookHistory.notes,
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
    rating: row.rating,
    notes: row.notes,
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

/**
 * One user's own log for one recipe, most recent first.
 *
 * Scoped to userId in the WHERE clause rather than checked beforehand. Cook
 * notes are private — "the sauce split, use less heat" is the user's own note
 * on a recipe that may well belong to somebody else — so there is no version of
 * this that reads another person's rows, and no recipe-ownership check to get
 * wrong. A recipe the user has never cooked returns an empty list, which is the
 * same answer a recipe that doesn't exist gives: nothing is disclosed either
 * way.
 *
 * Unpaginated on purpose. This is one person's cooks of one recipe; a user with
 * hundreds of them has a nicer problem than a missing page control.
 */
export async function getRecipeCookLog(
  userId: string,
  recipeId: string,
): Promise<CookHistoryRecord[]> {
  const db = await getDb();

  return db
    .select()
    .from(cookHistory)
    .where(and(eq(cookHistory.userId, userId), eq(cookHistory.recipeId, recipeId)))
    .orderBy(desc(cookHistory.cookedAt));
}

/**
 * Remove one log entry.
 *
 * Both the entry id and the owning user are in the WHERE clause, so an id
 * belonging to someone else matches nothing and reports not-found rather than
 * deleting. Returns false when nothing was removed.
 */
export async function deleteCookLogEntry(
  userId: string,
  entryId: string,
): Promise<boolean> {
  const db = await getDb();

  const deleted = await db
    .delete(cookHistory)
    .where(and(eq(cookHistory.id, entryId), eq(cookHistory.userId, userId)))
    .returning({ id: cookHistory.id });

  return deleted.length > 0;
}
