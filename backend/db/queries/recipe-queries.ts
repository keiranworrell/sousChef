import { and, asc, eq, desc, inArray, sql } from "drizzle-orm";
import { getDb } from "../client";
import { recipes, recipeIngredients, recipeSteps, recipeTags } from "../schema";

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

export type UpdateRecipeInput = Partial<
  Omit<CreateRecipeInput, "userId" | "ingredients" | "steps" | "tags">
> & { tags?: string[] };

export type ListRecipesResult = {
  recipes: (RecipeRecord & { tags: RecipeTagRecord[] })[];
  total: number;
  limit: number;
  offset: number;
};

export type ListRecipesParams = {
  limit?: number;
  offset?: number;
  tag?: string;
  difficulty?: string;
  sort?: "newest" | "oldest" | "title";
};

export async function listRecipes(
  userId: string,
  params: ListRecipesParams = {},
): Promise<ListRecipesResult> {
  const { limit = 20, offset = 0, tag, difficulty, sort = "newest" } = params;
  const db = getDb();

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
      return { recipes: [], total: 0, limit, offset };
    }
  }

  const baseWhere = and(
    eq(recipes.userId, userId),
    difficulty ? eq(recipes.difficulty, difficulty as "easy" | "medium" | "hard") : undefined,
    tagFilteredIds ? inArray(recipes.id, tagFilteredIds) : undefined,
  );

  const orderBy =
    sort === "oldest" ? asc(recipes.updatedAt)
    : sort === "title" ? asc(recipes.title)
    : desc(recipes.updatedAt);

  const [rows, [countRow], allTags] = await Promise.all([
    db.select().from(recipes).where(baseWhere).orderBy(orderBy).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(recipes).where(baseWhere),
    db
      .select()
      .from(recipeTags)
      .innerJoin(recipes, eq(recipeTags.recipeId, recipes.id))
      .where(eq(recipes.userId, userId)),
  ]);

  const tagsByRecipeId = new Map<string, RecipeTagRecord[]>();
  for (const row of allTags) {
    const existing = tagsByRecipeId.get(row.recipe_tags.recipeId) ?? [];
    existing.push(row.recipe_tags);
    tagsByRecipeId.set(row.recipe_tags.recipeId, existing);
  }

  const recipesWithTags = rows.map((r) => ({ ...r, tags: tagsByRecipeId.get(r.id) ?? [] }));

  return { recipes: recipesWithTags, total: countRow?.count ?? 0, limit, offset };
}

export async function getRecipeById(
  id: string,
  userId: string,
): Promise<RecipeWithDetails | null> {
  const db = getDb();

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
  const db = getDb();
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

export async function updateRecipe(
  id: string,
  userId: string,
  input: UpdateRecipeInput,
): Promise<RecipeRecord | null> {
  const db = getDb();

  const { tags, ...recipeFields } = input;

  const [updated] = await db
    .update(recipes)
    .set({ ...recipeFields, updatedAt: new Date() })
    .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
    .returning();

  if (!updated) return null;

  if (tags !== undefined) {
    await db.delete(recipeTags).where(eq(recipeTags.recipeId, id));
    if (tags.length > 0) {
      await db.insert(recipeTags).values(tags.map((tag) => ({ tag, recipeId: id })));
    }
  }

  return updated;
}

export async function deleteRecipe(
  id: string,
  userId: string,
): Promise<boolean> {
  const db = getDb();
  const result = await db
    .delete(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
    .returning({ id: recipes.id });
  return result.length > 0;
}
