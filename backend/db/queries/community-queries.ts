import { and, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { getDb } from "../client";
import { recipes, recipeIngredients, recipeSteps, recipeTags, users } from "../schema";
import type { RecipeWithDetails } from "./recipe-queries";

export type CommunityRecipeWithCreator = RecipeWithDetails & {
  creatorName: string;
};

export type CommunityFeedParams = {
  userId: string;
  q?: string | null;
  cuisine?: string | null;
  tag?: string | null;
  limit?: number;
  offset?: number;
};

export type CommunityFeedResult = {
  recipes: CommunityRecipeWithCreator[];
  total: number;
  limit: number;
  offset: number;
};

// ── Feed ──────────────────────────────────────────────────────────────────────

export async function listPublicRecipes(
  params: CommunityFeedParams,
): Promise<CommunityFeedResult> {
  const db = getDb();
  const { userId, q, cuisine, tag, limit = 20, offset = 0 } = params;

  // Build WHERE conditions — exclude the requesting user's own recipes
  const conditions = [eq(recipes.isPublic, true), ne(recipes.userId, userId)];

  if (q) {
    conditions.push(
      or(
        ilike(recipes.title, `%${q}%`),
        ilike(recipes.description, `%${q}%`),
      )!,
    );
  }

  if (cuisine) {
    conditions.push(ilike(recipes.cuisine, `%${cuisine}%`));
  }

  if (tag) {
    // Subquery: recipe IDs that have a matching tag
    const tagSubquery = db
      .select({ recipeId: recipeTags.recipeId })
      .from(recipeTags)
      .where(ilike(recipeTags.tag, `%${tag}%`));
    conditions.push(inArray(recipes.id, tagSubquery));
  }

  const where = and(...conditions);

  const [rows, [countRow]] = await Promise.all([
    db
      .select({ recipe: recipes, creatorName: users.displayName })
      .from(recipes)
      .innerJoin(users, eq(recipes.userId, users.id))
      .where(where)
      .orderBy(desc(recipes.updatedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(recipes)
      .where(where),
  ]);

  // Fetch details for all returned recipes in parallel
  const recipeIds = rows.map((r) => r.recipe.id);
  const fullRecipes = recipeIds.length > 0
    ? await fetchRecipeDetails(
        recipeIds,
        rows.map((r) => r.recipe),
        rows.map((r) => r.creatorName),
      )
    : [];

  return { recipes: fullRecipes, total: countRow?.count ?? 0, limit, offset };
}

async function fetchRecipeDetails(
  ids: string[],
  recipeRows: (typeof recipes.$inferSelect)[],
  creatorNames: string[],
): Promise<CommunityRecipeWithCreator[]> {
  const db = getDb();

  const [allIngredients, allSteps, allTags] = await Promise.all([
    db
      .select()
      .from(recipeIngredients)
      .where(inArray(recipeIngredients.recipeId, ids))
      .orderBy(recipeIngredients.orderIndex),
    db
      .select()
      .from(recipeSteps)
      .where(inArray(recipeSteps.recipeId, ids))
      .orderBy(recipeSteps.stepNumber),
    db
      .select()
      .from(recipeTags)
      .where(inArray(recipeTags.recipeId, ids)),
  ]);

  return recipeRows.map((recipe, idx) => ({
    ...recipe,
    ingredients: allIngredients.filter((i) => i.recipeId === recipe.id),
    steps: allSteps.filter((s) => s.recipeId === recipe.id),
    tags: allTags.filter((t) => t.recipeId === recipe.id),
    creatorName: creatorNames[idx] ?? "Unknown",
  }));
}

// ── Get single public recipe ───────────────────────────────────────────────────

export async function getPublicRecipe(id: string): Promise<CommunityRecipeWithCreator | null> {
  const db = getDb();
  const [row] = await db
    .select({ recipe: recipes, creatorName: users.displayName })
    .from(recipes)
    .innerJoin(users, eq(recipes.userId, users.id))
    .where(and(eq(recipes.id, id), eq(recipes.isPublic, true)));
  if (!row) return null;
  const [result] = await fetchRecipeDetails([row.recipe.id], [row.recipe], [row.creatorName]);
  return result ?? null;
}

// ── Fork ──────────────────────────────────────────────────────────────────────

export async function forkRecipe(
  recipeId: string,
  userId: string,
): Promise<RecipeWithDetails> {
  const db = getDb();

  // Fetch the source recipe (must be public)
  const source = await getPublicRecipe(recipeId);
  if (!source) throw new Error("Recipe not found or is not public");

  return db.transaction(async (tx) => {
    // Insert the forked recipe
    const [forked] = await tx
      .insert(recipes)
      .values({
        userId,
        title: source.title,
        description: source.description,
        imageUrl: source.imageUrl,
        servings: source.servings,
        prepTimeMinutes: source.prepTimeMinutes,
        cookTimeMinutes: source.cookTimeMinutes,
        difficulty: source.difficulty,
        cuisine: source.cuisine,
        isPublic: false,
        sourceUrl: source.sourceUrl,
        forkedFromId: source.id,
      })
      .returning();

    if (!forked) throw new Error("Fork insert returned no rows");

    // Copy ingredients, steps, tags in parallel
    const [ingredients, steps, tags] = await Promise.all([
      source.ingredients.length > 0
        ? tx
            .insert(recipeIngredients)
            .values(
              source.ingredients.map(({ id: _id, recipeId: _rid, ...rest }) => ({
                ...rest,
                recipeId: forked.id,
              })),
            )
            .returning()
        : Promise.resolve([]),
      source.steps.length > 0
        ? tx
            .insert(recipeSteps)
            .values(
              source.steps.map(({ id: _id, recipeId: _rid, ...rest }) => ({
                ...rest,
                recipeId: forked.id,
              })),
            )
            .returning()
        : Promise.resolve([]),
      source.tags.length > 0
        ? tx
            .insert(recipeTags)
            .values(
              source.tags.map(({ id: _id, recipeId: _rid, ...rest }) => ({
                ...rest,
                recipeId: forked.id,
              })),
            )
            .returning()
        : Promise.resolve([]),
    ]);

    return { ...forked, ingredients, steps, tags };
  });
}
