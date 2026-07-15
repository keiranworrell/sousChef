import { and, eq, inArray, isNull } from "drizzle-orm";
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

// ── Unit normalisation (for ingredient aggregation) ────────────────────────────

/** Converts weight measurements to grams. */
const WEIGHT_TO_G: Record<string, number> = {
  g: 1, gram: 1, grams: 1,
  kg: 1000, kilogram: 1000, kilograms: 1000,
  oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
  lb: 453.592, lbs: 453.592, pound: 453.592, pounds: 453.592,
};

/** Converts volume measurements to millilitres. */
const VOLUME_TO_ML: Record<string, number> = {
  ml: 1, milliliter: 1, milliliters: 1, millilitre: 1, millilitres: 1,
  l: 1000, liter: 1000, liters: 1000, litre: 1000, litres: 1000,
  tsp: 4.92892, teaspoon: 4.92892, teaspoons: 4.92892,
  tbsp: 14.7868, tablespoon: 14.7868, tablespoons: 14.7868,
  cup: 236.588, cups: 236.588,
  "fl oz": 29.5735, "fluid oz": 29.5735,
  pt: 473.176, pint: 473.176, pints: 473.176,
  qt: 946.353, quart: 946.353, quarts: 946.353,
  gal: 3785.41, gallon: 3785.41, gallons: 3785.41,
};

type Normalised = { quantity: number | null; unit: string | null };

function normaliseUnit(quantity: number | null, unit: string | null): Normalised {
  if (!unit) return { quantity, unit: null };
  const u = unit.toLowerCase().trim();

  if (Object.prototype.hasOwnProperty.call(WEIGHT_TO_G, u)) {
    const factor = WEIGHT_TO_G[u]!;
    return { quantity: quantity !== null ? quantity * factor : null, unit: "g" };
  }
  if (Object.prototype.hasOwnProperty.call(VOLUME_TO_ML, u)) {
    const factor = VOLUME_TO_ML[u]!;
    return { quantity: quantity !== null ? quantity * factor : null, unit: "ml" };
  }
  return { quantity, unit };
}

/** Aggregates raw ingredients: normalises units then merges by name + unit. */
function aggregateIngredients(
  raw: Array<{ name: string; quantity: number | null; unit: string | null }>,
): MealPlanIngredient[] {
  const groups = new Map<string, MealPlanIngredient>();

  for (const ing of raw) {
    const { quantity: normQty, unit: normUnit } = normaliseUnit(ing.quantity, ing.unit);
    const key = `${ing.name.toLowerCase().trim()}|${normUnit ?? ""}`;

    const existing = groups.get(key);
    if (existing) {
      if (existing.quantity !== null && normQty !== null) {
        existing.quantity += normQty;
      } else if (normQty !== null) {
        existing.quantity = normQty;
      }
    } else {
      groups.set(key, { name: ing.name.trim(), quantity: normQty, unit: normUnit });
    }
  }

  return Array.from(groups.values());
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the Monday (UTC) for the week containing a given date. */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Gets or creates the meal plan for a given week.
 * When householdId is set the plan is shared across all household members.
 */
export async function getOrCreateMealPlan(
  userId: string,
  householdId: string | null,
  weekStart: Date,
): Promise<MealPlanWithEntries> {
  const db = await getDb();

  const planWhere = householdId
    ? and(eq(mealPlans.householdId, householdId), eq(mealPlans.weekStartDate, weekStart))
    : and(eq(mealPlans.userId, userId), isNull(mealPlans.householdId), eq(mealPlans.weekStartDate, weekStart));

  let [plan] = await db.select().from(mealPlans).where(planWhere);

  if (!plan) {
    [plan] = await db
      .insert(mealPlans)
      .values({ userId, householdId: householdId ?? null, weekStartDate: weekStart })
      .returning();
  }

  if (!plan) throw new Error("Failed to get or create meal plan");

  const entries = await getEntriesWithRecipes(plan.id);
  return { ...plan, entries };
}

async function getEntriesWithRecipes(planId: string): Promise<MealPlanEntryWithRecipe[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id:            mealPlanEntries.id,
      mealPlanId:    mealPlanEntries.mealPlanId,
      recipeId:      mealPlanEntries.recipeId,
      dayOfWeek:     mealPlanEntries.dayOfWeek,
      mealType:      mealPlanEntries.mealType,
      recipeTitle:   recipes.title,
      recipeImageUrl: recipes.imageUrl,
      recipeServings: recipes.servings,
    })
    .from(mealPlanEntries)
    .innerJoin(recipes, eq(mealPlanEntries.recipeId, recipes.id))
    .where(eq(mealPlanEntries.mealPlanId, planId));

  return rows.map((row) => ({
    id:         row.id,
    mealPlanId: row.mealPlanId,
    recipeId:   row.recipeId,
    dayOfWeek:  row.dayOfWeek,
    mealType:   row.mealType,
    recipe: {
      id:       row.recipeId,
      title:    row.recipeTitle,
      imageUrl: row.recipeImageUrl,
      servings: row.recipeServings,
    },
  }));
}

export async function createMealPlanEntry(
  input: CreateMealPlanEntryInput,
): Promise<MealPlanEntryWithRecipe> {
  const db = await getDb();
  const [entry] = await db
    .insert(mealPlanEntries)
    .values({
      mealPlanId: input.mealPlanId,
      recipeId:   input.recipeId,
      dayOfWeek:  String(input.dayOfWeek) as "0" | "1" | "2" | "3" | "4" | "5" | "6",
      mealType:   input.mealType,
    })
    .returning();

  if (!entry) throw new Error("Insert returned no rows");

  const [recipeRow] = await db
    .select({ id: recipes.id, title: recipes.title, imageUrl: recipes.imageUrl, servings: recipes.servings })
    .from(recipes)
    .where(eq(recipes.id, input.recipeId));

  if (!recipeRow) throw new Error("Recipe not found after insert");

  return { ...entry, recipe: recipeRow };
}

export async function deleteMealPlanEntry(
  entryId: string,
  planId: string,
): Promise<boolean> {
  const db = await getDb();
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
 * Returns deduplicated, unit-normalised ingredients across every recipe in a meal plan.
 * Weight units are converted to grams; volume units to millilitres.
 * Quantities are summed when name+unit match. Weight/volume mismatches stay separate.
 * Verifies the plan belongs to the user or their household.
 */
export async function getMealPlanIngredients(
  planId: string,
  userId: string,
  householdId: string | null,
): Promise<MealPlanIngredient[] | null> {
  const db = await getDb();

  const planWhere = householdId
    ? and(eq(mealPlans.id, planId), eq(mealPlans.householdId, householdId))
    : and(eq(mealPlans.id, planId), eq(mealPlans.userId, userId));

  const [plan] = await db.select({ id: mealPlans.id }).from(mealPlans).where(planWhere);
  if (!plan) return null;

  const entries = await db
    .select({ recipeId: mealPlanEntries.recipeId })
    .from(mealPlanEntries)
    .where(eq(mealPlanEntries.mealPlanId, planId));

  if (entries.length === 0) return [];

  const recipeIds = [...new Set(entries.map((e) => e.recipeId))];

  const raw = await db
    .select({
      name:     recipeIngredients.name,
      quantity: recipeIngredients.quantity,
      unit:     recipeIngredients.unit,
    })
    .from(recipeIngredients)
    .where(inArray(recipeIngredients.recipeId, recipeIds));

  return aggregateIngredients(raw);
}
