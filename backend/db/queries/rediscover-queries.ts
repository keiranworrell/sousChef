import { asc, desc, inArray, max, sql } from "drizzle-orm";
import { getDb } from "../client";
import { cookHistory, recipes, recipeTags } from "../schema";

export type RediscoverMode = "cook-again" | "never-tried";

export type RediscoverRecipe = {
  id: string;
  title: string;
  imageUrl: string | null;
  cuisine: string | null;
  difficulty: "easy" | "medium" | "hard" | null;
  cookTimeMinutes: number | null;
  tags: string[];
  lastCookedAt: string | null; // only populated for cook-again
};

/**
 * cook-again: recipes the user has cooked at least once, ordered by
 * least recently cooked first (longest overdue at the top).
 *
 * never-tried: recipes the user owns but has never logged a cook for.
 */
export async function getRediscoverRecipes(
  userId: string,
  mode: RediscoverMode,
  limit = 50,
): Promise<RediscoverRecipe[]> {
  const db = await getDb();

  if (mode === "cook-again") {
    const lastCookedAt = max(cookHistory.cookedAt).as("last_cooked_at");

    const rows = await db
      .select({
        id: recipes.id,
        title: recipes.title,
        imageUrl: recipes.imageUrl,
        cuisine: recipes.cuisine,
        difficulty: recipes.difficulty,
        cookTimeMinutes: recipes.cookTimeMinutes,
        lastCookedAt,
      })
      .from(recipes)
      .innerJoin(cookHistory, sql`${cookHistory.recipeId} = ${recipes.id} AND ${cookHistory.userId} = ${userId}`)
      .where(sql`${recipes.userId} = ${userId}`)
      .groupBy(recipes.id)
      .orderBy(asc(lastCookedAt)) // least recently cooked first
      .limit(limit);

    const base = rows.map((r) => ({
      id: r.id,
      title: r.title,
      imageUrl: r.imageUrl,
      cuisine: r.cuisine,
      difficulty: r.difficulty as RediscoverRecipe["difficulty"],
      cookTimeMinutes: r.cookTimeMinutes,
      lastCookedAt: r.lastCookedAt ? String(r.lastCookedAt) : null,
    }));

    return attachTags(db, base);
  }

  // never-tried: LEFT JOIN cook_history filtered to this user, keep only rows
  // where no matching cook_history row exists
  const rows = await db
    .select({
      id: recipes.id,
      title: recipes.title,
      imageUrl: recipes.imageUrl,
      cuisine: recipes.cuisine,
      difficulty: recipes.difficulty,
      cookTimeMinutes: recipes.cookTimeMinutes,
    })
    .from(recipes)
    .leftJoin(cookHistory, sql`${cookHistory.recipeId} = ${recipes.id} AND ${cookHistory.userId} = ${userId}`)
    .where(sql`${recipes.userId} = ${userId} AND ${cookHistory.id} IS NULL`)
    .orderBy(desc(recipes.createdAt))
    .limit(limit);

  const base = rows.map((r) => ({
    id: r.id,
    title: r.title,
    imageUrl: r.imageUrl,
    cuisine: r.cuisine,
    difficulty: r.difficulty as RediscoverRecipe["difficulty"],
    cookTimeMinutes: r.cookTimeMinutes,
    lastCookedAt: null,
  }));

  return attachTags(db, base);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type BaseRow = Omit<RediscoverRecipe, "tags">;

async function attachTags(
  db: Awaited<ReturnType<typeof getDb>>,
  rows: BaseRow[],
): Promise<RediscoverRecipe[]> {
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const tagRows = await db
    .select({ recipeId: recipeTags.recipeId, tag: recipeTags.tag })
    .from(recipeTags)
    .where(inArray(recipeTags.recipeId, ids));

  const tagMap = new Map<string, string[]>();
  for (const { recipeId, tag } of tagRows) {
    const list = tagMap.get(recipeId) ?? [];
    list.push(tag);
    tagMap.set(recipeId, list);
  }

  return rows.map((r) => ({ ...r, tags: tagMap.get(r.id) ?? [] }));
}
