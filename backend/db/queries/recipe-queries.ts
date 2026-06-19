import { and, eq, desc, sql } from "drizzle-orm";
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
  servings?: number;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  difficulty?: "easy" | "medium" | "hard" | null;
  cuisine?: string | null;
  isPublic?: boolean;
  ingredients?: CreateIngredientInput[];
  steps?: CreateStepInput[];
  tags?: string[];
};

export type UpdateRecipeInput = Partial<
  Omit<CreateRecipeInput, "userId" | "ingredients" | "steps" | "tags">
>;

export type ListRecipesResult = {
  recipes: RecipeRecord[];
  total: number;
  limit: number;
  offset: number;
};

export async function listRecipes(
  userId: string,
  limit = 20,
  offset = 0,
): Promise<ListRecipesResult> {
  const db = getDb();

  const [rows, [countRow]] = await Promise.all([
    db
      .select()
      .from(recipes)
      .where(eq(recipes.userId, userId))
      .orderBy(desc(recipes.updatedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(recipes)
      .where(eq(recipes.userId, userId)),
  ]);

  return { recipes: rows, total: countRow?.count ?? 0, limit, offset };
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

  const [updated] = await db
    .update(recipes)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
    .returning();

  return updated ?? null;
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
