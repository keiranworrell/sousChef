import { and, count, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { getDb } from "../client";
import { recipes, recipeIngredients, recipeSteps, recipeTags, users, recipeLikes } from "../schema";
import type { RecipeWithDetails } from "./recipe-queries";

export type CommunityRecipeWithCreator = RecipeWithDetails & {
  creatorName: string;
  creatorId: string;
  likeCount: number;
  isLiked: boolean;
  forkCount: number;
};

export type CommunityFeedParams = {
  userId: string;
  q?: string | null;
  cuisine?: string | null;
  tag?: string | null;
  creator?: string | null;
  creatorId?: string | null;
  sort?: "popular" | null;
  limit?: number;
  offset?: number;
};

export type CommunityFeedResult = {
  recipes: CommunityRecipeWithCreator[];
  total: number;
  limit: number;
  offset: number;
};

// ── Likes ─────────────────────────────────────────────────────────────────────

export async function likeRecipe(userId: string, recipeId: string): Promise<void> {
  const db = await getDb();
  await db
    .insert(recipeLikes)
    .values({ userId, recipeId })
    .onConflictDoNothing();
}

export async function unlikeRecipe(userId: string, recipeId: string): Promise<void> {
  const db = await getDb();
  await db
    .delete(recipeLikes)
    .where(and(eq(recipeLikes.userId, userId), eq(recipeLikes.recipeId, recipeId)));
}

// ── Feed ──────────────────────────────────────────────────────────────────────

export async function listPublicRecipes(
  params: CommunityFeedParams,
): Promise<CommunityFeedResult> {
  const db = await getDb();
  const { userId, q, cuisine, tag, creator, creatorId, sort, limit = 20, offset = 0 } = params;

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
    const tagSubquery = db
      .select({ recipeId: recipeTags.recipeId })
      .from(recipeTags)
      .where(ilike(recipeTags.tag, `%${tag}%`));
    conditions.push(inArray(recipes.id, tagSubquery));
  }

  if (creator) {
    const creatorSubquery = db
      .select({ id: recipes.id })
      .from(recipes)
      .innerJoin(users, eq(recipes.userId, users.id))
      .where(ilike(users.displayName, `%${creator}%`));
    conditions.push(inArray(recipes.id, creatorSubquery));
  }

  if (creatorId) {
    conditions.push(eq(recipes.userId, creatorId));
  }

  const where = and(...conditions);

  // For popular sort, join a like-count subquery and order by it descending
  const likeCountSq = db
    .select({
      recipeId: recipeLikes.recipeId,
      cnt: count().as("cnt"),
    })
    .from(recipeLikes)
    .groupBy(recipeLikes.recipeId)
    .as("lc");

  const orderBy = sort === "popular"
    ? desc(sql`coalesce(${likeCountSq.cnt}, 0)`)
    : desc(recipes.updatedAt);

  const [rows, [countRow]] = await Promise.all([
    db
      .select({ recipe: recipes, creatorName: users.displayName, creatorId: users.id })
      .from(recipes)
      .innerJoin(users, eq(recipes.userId, users.id))
      .leftJoin(likeCountSq, eq(recipes.id, likeCountSq.recipeId))
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(recipes)
      .where(where),
  ]);

  const recipeIds = rows.map((r) => r.recipe.id);
  const fullRecipes = recipeIds.length > 0
    ? await fetchRecipeDetails(
        recipeIds,
        rows.map((r) => r.recipe),
        rows.map((r) => r.creatorName),
        rows.map((r) => r.creatorId),
        userId,
      )
    : [];

  return { recipes: fullRecipes, total: countRow?.count ?? 0, limit, offset };
}

async function fetchRecipeDetails(
  ids: string[],
  recipeRows: (typeof recipes.$inferSelect)[],
  creatorNames: string[],
  creatorIds: string[],
  requestingUserId: string,
): Promise<CommunityRecipeWithCreator[]> {
  const db = await getDb();

  const [allIngredients, allSteps, allTags, likeCountRows, likedRows, forkCountRows] =
    await Promise.all([
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
      // Total like counts per recipe
      db
        .select({ recipeId: recipeLikes.recipeId, cnt: count() })
        .from(recipeLikes)
        .where(inArray(recipeLikes.recipeId, ids))
        .groupBy(recipeLikes.recipeId),
      // Which of these recipes the requesting user has liked
      db
        .select({ recipeId: recipeLikes.recipeId })
        .from(recipeLikes)
        .where(
          and(
            eq(recipeLikes.userId, requestingUserId),
            inArray(recipeLikes.recipeId, ids),
          ),
        ),
      // Fork counts per recipe
      db
        .select({ forkedFromId: recipes.forkedFromId, cnt: count() })
        .from(recipes)
        .where(and(inArray(recipes.forkedFromId, ids), eq(recipes.isPublic, false)))
        .groupBy(recipes.forkedFromId),
    ]);

  const likeCountMap = new Map(likeCountRows.map((r) => [r.recipeId, r.cnt]));
  const likedSet = new Set(likedRows.map((r) => r.recipeId));
  const forkCountMap = new Map(forkCountRows.map((r) => [r.forkedFromId ?? "", r.cnt]));

  return recipeRows.map((recipe, idx) => ({
    ...recipe,
    ingredients: allIngredients.filter((i) => i.recipeId === recipe.id),
    steps: allSteps.filter((s) => s.recipeId === recipe.id),
    tags: allTags.filter((t) => t.recipeId === recipe.id),
    creatorName: creatorNames[idx] ?? "Unknown",
    creatorId: creatorIds[idx] ?? "",
    likeCount: likeCountMap.get(recipe.id) ?? 0,
    isLiked: likedSet.has(recipe.id),
    forkCount: forkCountMap.get(recipe.id) ?? 0,
  }));
}

// ── Get single public recipe ───────────────────────────────────────────────────

export async function getPublicRecipe(
  id: string,
  requestingUserId: string,
): Promise<CommunityRecipeWithCreator | null> {
  const db = await getDb();
  const [row] = await db
    .select({ recipe: recipes, creatorName: users.displayName, creatorId: users.id })
    .from(recipes)
    .innerJoin(users, eq(recipes.userId, users.id))
    .where(and(eq(recipes.id, id), eq(recipes.isPublic, true)));
  if (!row) return null;
  const [result] = await fetchRecipeDetails(
    [row.recipe.id],
    [row.recipe],
    [row.creatorName],
    [row.creatorId],
    requestingUserId,
  );
  return result ?? null;
}

// ── Fork ──────────────────────────────────────────────────────────────────────

export async function forkRecipe(
  recipeId: string,
  userId: string,
): Promise<RecipeWithDetails> {
  const db = await getDb();

  // Fetch the source recipe (must be public)
  const source = await getPublicRecipe(recipeId, userId);
  if (!source) throw new Error("Recipe not found or is not public");

  return db.transaction(async (tx) => {
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
