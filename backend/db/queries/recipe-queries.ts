import { and, asc, eq, desc, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "../client";
import { recipes, recipeIngredients, recipeSteps, recipeTags } from "../schema";
import { decodeCursor, encodeCursor } from "./cursor";

export type RecipeRecord = typeof recipes.$inferSelect;
export type RecipeIngredientRecord = typeof recipeIngredients.$inferSelect;
export type RecipeStepRecord = typeof recipeSteps.$inferSelect;
export type RecipeTagRecord = typeof recipeTags.$inferSelect;

export type RecipeWithDetails = RecipeRecord & {
  ingredients: RecipeIngredientRecord[];
  steps: RecipeStepRecord[];
  tags: RecipeTagRecord[];
};

export type CreateIngredientInput = {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  notes?: string | null;
  orderIndex: number;
};

export type CreateStepInput = {
  stepNumber: number;
  instruction: string;
  timerSeconds?: number | null;
};

export type CreateRecipeInput = {
  userId: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  servings?: number;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  difficulty?: "easy" | "medium" | "hard" | null;
  cuisine?: string | null;
  isPublic?: boolean;
  sourceUrl?: string | null;
  ingredients?: CreateIngredientInput[];
  steps?: CreateStepInput[];
  tags?: string[];
};

export type UpdateRecipeInput = Partial<Omit<CreateRecipeInput, "userId">>;

export type ListRecipesResult = {
  recipes: (RecipeRecord & { tags: string[] })[];
  /** Opaque cursor for the next page; null when the last page has been reached. */
  nextCursor: string | null;
  /**
   * Total matching rows. Only computed on the first page (no cursor supplied) —
   * counting on every page is wasted work when the caller is appending to a list
   * it already has.
   */
  total: number | null;
  limit: number;
};

export type ListRecipesParams = {
  limit?: number;
  cursor?: string | null;
  q?: string;
  tag?: string;
  difficulty?: string;
  sort?: "newest" | "oldest" | "title";
};

export async function listRecipes(
  userId: string,
  params: ListRecipesParams = {},
): Promise<ListRecipesResult> {
  const { limit = 20, cursor: rawCursor, q, tag, difficulty, sort = "newest" } = params;
  const db = await getDb();
  const cursor = decodeCursor(rawCursor);

  // If filtering by tag, first find matching recipe IDs
  let tagFilteredIds: string[] | null = null;
  if (tag) {
    const tagRows = await db
      .select({ recipeId: recipeTags.recipeId })
      .from(recipeTags)
      .innerJoin(recipes, eq(recipeTags.recipeId, recipes.id))
      .where(and(eq(recipes.userId, userId), eq(recipeTags.tag, tag.toLowerCase().trim())));
    tagFilteredIds = tagRows.map((r) => r.recipeId);
    if (tagFilteredIds.length === 0) {
      return { recipes: [], nextCursor: null, total: 0, limit };
    }
  }

  // Full-text search across title, description, cuisine, and ingredient names
  const searchCondition = q
    ? or(
        ilike(recipes.title, `%${q}%`),
        ilike(recipes.description, `%${q}%`),
        ilike(recipes.cuisine, `%${q}%`),
        sql`EXISTS (
          SELECT 1 FROM recipe_ingredients
          WHERE recipe_id = ${recipes.id}
          AND name ILIKE ${"%" + q + "%"}
        )`,
      )
    : undefined;

  // Keyset predicate. Postgres row-value comparison `(a, b) < (x, y)` compares
  // lexicographically and can use a composite index directly, so this stays fast
  // at any depth — unlike OFFSET, which scans and discards everything before it.
  //
  // The comparison direction mirrors the sort direction, and the id tiebreaker
  // must use the same direction as the leading column for the row-value
  // comparison to be correct.
  let keysetCondition: SQL | undefined;
  if (cursor) {
    if (cursor.k === "title" && sort === "title") {
      keysetCondition = sql`(${recipes.title}, ${recipes.id}) > (${cursor.v}, ${cursor.id}::uuid)`;
    } else if (cursor.k === "updatedAt" && sort === "oldest") {
      keysetCondition = sql`(${recipes.updatedAt}, ${recipes.id}) > (${new Date(cursor.v)}, ${cursor.id}::uuid)`;
    } else if (cursor.k === "updatedAt" && sort === "newest") {
      keysetCondition = sql`(${recipes.updatedAt}, ${recipes.id}) < (${new Date(cursor.v)}, ${cursor.id}::uuid)`;
    }
    // A cursor whose key doesn't match the current sort is stale — the user
    // changed sort mid-scroll. Ignoring it restarts from the first page, which
    // is the correct result for a re-sorted list.
  }

  const baseWhere = and(
    eq(recipes.userId, userId),
    searchCondition,
    difficulty ? eq(recipes.difficulty, difficulty as "easy" | "medium" | "hard") : undefined,
    tagFilteredIds ? inArray(recipes.id, tagFilteredIds) : undefined,
  );

  const pageWhere = keysetCondition ? and(baseWhere, keysetCondition) : baseWhere;

  const orderBy =
    sort === "oldest" ? [asc(recipes.updatedAt), asc(recipes.id)]
    : sort === "title" ? [asc(recipes.title), asc(recipes.id)]
    : [desc(recipes.updatedAt), desc(recipes.id)];

  // Fetch one extra row to determine whether a further page exists, rather than
  // issuing a second count query per page.
  const [rows, allTags, countRows] = await Promise.all([
    db.select().from(recipes).where(pageWhere).orderBy(...orderBy).limit(limit + 1),
    db
      .select()
      .from(recipeTags)
      .innerJoin(recipes, eq(recipeTags.recipeId, recipes.id))
      .where(eq(recipes.userId, userId)),
    cursor
      ? Promise.resolve([])
      : db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(recipes).where(baseWhere),
  ]);

  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();

  const tagsByRecipeId = new Map<string, RecipeTagRecord[]>();
  for (const row of allTags) {
    const existing = tagsByRecipeId.get(row.recipe_tags.recipeId) ?? [];
    existing.push(row.recipe_tags);
    tagsByRecipeId.set(row.recipe_tags.recipeId, existing);
  }

  const recipesWithTags = rows.map((r) => ({
    ...r,
    tags: (tagsByRecipeId.get(r.id) ?? []).map((t) => t.tag),
  }));

  // Build the cursor from the last row actually returned, keyed to match the sort
  const last = rows[rows.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor(
          sort === "title"
            ? { k: "title", v: last.title, id: last.id }
            : { k: "updatedAt", v: last.updatedAt.toISOString(), id: last.id },
        )
      : null;

  return {
    recipes: recipesWithTags,
    nextCursor,
    total: cursor ? null : (countRows[0]?.count ?? 0),
    limit,
  };
}

export async function getRecipeById(
  id: string,
  userId: string,
): Promise<RecipeWithDetails | null> {
  const db = await getDb();

  const [recipe] = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
    .limit(1);

  if (!recipe) return null;

  const [ingredients, steps, tags] = await Promise.all([
    db
      .select()
      .from(recipeIngredients)
      .where(eq(recipeIngredients.recipeId, id))
      .orderBy(recipeIngredients.orderIndex),
    db
      .select()
      .from(recipeSteps)
      .where(eq(recipeSteps.recipeId, id))
      .orderBy(recipeSteps.stepNumber),
    db.select().from(recipeTags).where(eq(recipeTags.recipeId, id)),
  ]);

  return { ...recipe, ingredients, steps, tags };
}

export async function createRecipe(
  input: CreateRecipeInput,
): Promise<RecipeWithDetails> {
  const db = await getDb();
  const { ingredients = [], steps = [], tags = [], ...recipeData } = input;

  const [recipe] = await db.insert(recipes).values(recipeData).returning();
  if (!recipe) throw new Error("Insert returned no rows");

  const [insertedIngredients, insertedSteps, insertedTags] = await Promise.all([
    ingredients.length > 0
      ? db
          .insert(recipeIngredients)
          .values(ingredients.map((i) => ({ ...i, recipeId: recipe.id })))
          .returning()
      : Promise.resolve([]),
    steps.length > 0
      ? db
          .insert(recipeSteps)
          .values(steps.map((s) => ({ ...s, recipeId: recipe.id })))
          .returning()
      : Promise.resolve([]),
    tags.length > 0
      ? db
          .insert(recipeTags)
          .values(tags.map((tag) => ({ tag, recipeId: recipe.id })))
          .returning()
      : Promise.resolve([]),
  ]);

  return {
    ...recipe,
    ingredients: insertedIngredients,
    steps: insertedSteps,
    tags: insertedTags,
  };
}

/**
 * Whether an update actually alters the recipe's content.
 *
 * Only content counts. `isPublic` is visibility, not authorship — adding a
 * recipe to a public collection flips it, and that shouldn't make an untouched
 * import read as "adapted". Tags are excluded for the same reason: filing
 * something under "weeknight" isn't adapting it.
 *
 * An omitted field means "unchanged", so it can't register as a difference.
 */
export function contentDiffers(
  existing: RecipeWithDetails,
  incoming: UpdateRecipeInput,
): boolean {
  const scalarChanged = (
    [
      "title",
      "description",
      "servings",
      "prepTimeMinutes",
      "cookTimeMinutes",
      "difficulty",
      "cuisine",
    ] as const
  ).some((key) => incoming[key] !== undefined && incoming[key] !== existing[key]);
  if (scalarChanged) return true;

  if (incoming.ingredients !== undefined) {
    const before = existing.ingredients.map(
      (i) => `${i.name}|${i.quantity ?? ""}|${i.unit ?? ""}|${i.notes ?? ""}`,
    );
    const after = incoming.ingredients.map(
      (i) => `${i.name}|${i.quantity ?? ""}|${i.unit ?? ""}|${i.notes ?? ""}`,
    );
    if (before.length !== after.length || before.some((v, idx) => v !== after[idx])) {
      return true;
    }
  }

  if (incoming.steps !== undefined) {
    const before = existing.steps.map((s) => `${s.instruction}|${s.timerSeconds ?? ""}`);
    const after = incoming.steps.map((s) => `${s.instruction}|${s.timerSeconds ?? ""}`);
    if (before.length !== after.length || before.some((v, idx) => v !== after[idx])) {
      return true;
    }
  }

  return false;
}

export async function updateRecipe(
  id: string,
  userId: string,
  input: UpdateRecipeInput,
): Promise<RecipeWithDetails | null> {
  const db = await getDb();

  const { tags, ingredients, steps, ...recipeFields } = input;

  // Read the current state before writing, so "has this been adapted?" can be
  // answered by comparing values rather than by whether a field was submitted.
  // The edit form posts every field on every save, so presence alone would mark
  // a recipe adapted even when the user changed nothing.
  const existing = await getRecipeById(id, userId);
  if (!existing) return null;

  const hasExternalSource = existing.sourceUrl !== null || existing.forkedFromId !== null;
  const sourceModified =
    existing.sourceModified ||
    (hasExternalSource && contentDiffers(existing, { ...recipeFields, ingredients, steps }));

  const [updated] = await db
    .update(recipes)
    .set({ ...recipeFields, sourceModified, updatedAt: new Date() })
    .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
    .returning();

  if (!updated) return null;

  if (tags !== undefined) {
    await db.delete(recipeTags).where(eq(recipeTags.recipeId, id));
    if (tags.length > 0) {
      await db.insert(recipeTags).values(tags.map((tag) => ({ tag, recipeId: id })));
    }
  }

  if (ingredients !== undefined) {
    await db.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, id));
    if (ingredients.length > 0) {
      await db
        .insert(recipeIngredients)
        .values(ingredients.map((i) => ({ ...i, recipeId: id })));
    }
  }

  if (steps !== undefined) {
    await db.delete(recipeSteps).where(eq(recipeSteps.recipeId, id));
    if (steps.length > 0) {
      await db
        .insert(recipeSteps)
        .values(steps.map((s) => ({ ...s, recipeId: id })));
    }
  }

  return getRecipeById(id, userId);
}

export type DeleteRecipeResult = { imageUrl: string | null } | null;

/**
 * Deletes a recipe owned by userId. Returns the deleted recipe's imageUrl
 * so the caller can clean up S3, or null if the recipe was not found.
 */
export async function deleteRecipe(
  id: string,
  userId: string,
): Promise<DeleteRecipeResult> {
  const db = await getDb();
  const result = await db
    .delete(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
    .returning({ imageUrl: recipes.imageUrl });
  return result[0] ?? null;
}
