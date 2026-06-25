import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../client";
import { mealPlans, mealPlanEntries, recipes, recipeIngredients } from "../schema";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MealPlanRecord = typeof mealPlans.$inferSelect;
export type MealPlanEntryRecord = typeof mealPlanEntries.$inferSelect;

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export type MealPlanEntryWithRecipe = MealPlanEntryRecord & {
  recipe: {
    id: string;
    title: string;
    imageUrl: string | null;
    servings: number;
  };
};

export type MealPlanWithEntries = MealPlanRecord & {
  entries: MealPlanEntryWithRecipe[];
};

export type CreateMealPlanEntryInput = {
  mealPlanId: string;
  recipeId: string;
  dayOfWeek: DayOfWeek;
  mealType: MealType;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the Monday (UTC) for the week containing a given date. */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  // getUTCDay(): 0=Sun, 1=Mon … adjust so Monday=0
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getOrCreateMealPlan(
  userId: string,
  weekStart: Date,
): Promise<MealPlanWithEntries> {
  const db = getDb();

  // Find existing plan for this week
  let [plan] = await db
    .select()
    .from(mealPlans)
    .where(
      and(
        eq(mealPlans.userId, userId),
        eq(mealPlans.weekStartDate, weekStart),
      ),
    );

  // Create if missing
  if (!plan) {
    [plan] = await db
      .insert(mealPlans)
      .values({ userId, weekStartDate: weekStart })
      .returning();
  }

  if (!plan) throw new Error("Failed to get or create meal plan");

  const entries = await getEntriesWithRecipes(plan.id);
  return { ...plan, entries };
}

async function getEntriesWithRecipes(planId: string): Promise<MealPlanEntryWithRecipe[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: mealPlanEntries.id,
      mealPlanId: mealPlanEntries.mealPlanId,
      recipeId: mealPlanEntries.recipeId,
      dayOfWeek: mealPlanEntries.dayOfWeek,
      mealType: mealPlanEntries.mealType,
      recipeTitle: recipes.title,
      recipeImageUrl: recipes.imageUrl,
      recipeServings: recipes.servings,
    })
    .from(mealPlanEntries)
    .innerJoin(recipes, eq(mealPlanEntries.recipeId, recipes.id))
    .where(eq(mealPlanEntries.mealPlanId, planId));

  return rows.map((row) => ({
    id: row.id,
    mealPlanId: row.mealPlanId,
    recipeId: row.recipeId,
    dayOfWeek: row.dayOfWeek,
    mealType: row.mealType,
    recipe: {
      id: row.recipeId,
      title: row.recipeTitle,
      imageUrl: row.recipeImageUrl,
      servings: row.recipeServings,
    },
  }));
}

export async function createMealPlanEntry(
  input: CreateMealPlanEntryInput,
): Promise<MealPlanEntryWithRecipe> {
  const db = getDb();
  const [entry] = await db
    .insert(mealPlanEntries)
    .values({
      mealPlanId: input.mealPlanId,
      recipeId: input.recipeId,
      dayOfWeek: String(input.dayOfWeek) as "0" | "1" | "2" | "3" | "4" | "5" | "6",
      mealType: input.mealType,
    })
    .returning();

  if (!entry) throw new Error("Insert returned no rows");

  const [recipeRow] = await db
    .select({
      id: recipes.id,
      title: recipes.title,
      imageUrl: recipes.imageUrl,
      servings: recipes.servings,
    })
    .from(recipes)
    .where(eq(recipes.id, input.recipeId));

  if (!recipeRow) throw new Error("Recipe not found after insert");

  return {
    ...entry,
    recipe: recipeRow,
  };
}

export async function deleteMealPlanEntry(
  entryId: string,
  planId: string,
): Promise<boolean> {
  const db = getDb();
  const result = await db
    .delete(mealPlanEntries)
    .where(
      and(
        eq(mealPlanEntries.id, entryId),
        eq(mealPlanEntries.mealPlanId, planId),
      ),
    )
    .returning({ id: mealPlanEntries.id });
  return result.length > 0;
}

export type MealPlanIngredient = {
  name: string;
  quantity: number | null;
  unit: string | null;
};

/**
 * Returns all ingredients across every recipe in a meal plan.
 * Verifies the plan belongs to the given userId.
 */
export async function getMealPlanIngredients(
  planId: string,
  userId: string,
): Promise<MealPlanIngredient[] | null> {
  const db = getDb();

  // Confirm plan ownership
  const [plan] = await db
    .select({ id: mealPlans.id })
    .from(mealPlans)
    .where(and(eq(mealPlans.id, planId), eq(mealPlans.userId, userId)));
  if (!plan) return null;

  // Get distinct recipe IDs for this plan
  const entries = await db
    .select({ recipeId: mealPlanEntries.recipeId })
    .from(mealPlanEntries)
    .where(eq(mealPlanEntries.mealPlanId, planId));

  if (entries.length === 0) return [];

  const recipeIds = [...new Set(entries.map((e) => e.recipeId))];

  const ingredients = await db
    .select({
      name: recipeIngredients.name,
      quantity: recipeIngredients.quantity,
      unit: recipeIngredients.unit,
    })
    .from(recipeIngredients)
    .where(inArray(recipeIngredients.recipeId, recipeIds));

  return ingredients;
}
