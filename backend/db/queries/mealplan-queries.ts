import { and, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "../client";
import { mealPlans, mealPlanEntries, recipes, recipeIngredients } from "../schema";
import { normaliseIngredientName } from "@souschef/shared";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MealPlanRecord = typeof mealPlans.$inferSelect;
export type MealPlanEntryRecord = typeof mealPlanEntries.$inferSelect;

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

/**
 * Display order for meal types within a day. Untagged entries sort last — they
 * have no claim to a position, so they queue behind anything that does.
 */
const MEAL_TYPE_RANK: Record<MealType, number> = {
  breakfast: 0,
  lunch: 1,
  dinner: 2,
  snack: 3,
};

function mealTypeRank(mealType: MealType | null): number {
  return mealType ? MEAL_TYPE_RANK[mealType] : 99;
}

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
  /** Optional label. Omit for an untagged entry. */
  mealType?: MealType | null;
  /** How many people this entry is for. Null/omitted means "as written". */
  servings?: number | null;
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

/**
 * Aggregates raw ingredients: normalises units, then merges by canonical name
 * plus unit.
 *
 * The grouping key used to be the raw lowercased name, which meant "salt" and
 * "salt, a sprinkle" — the same purchase written two ways — landed on the
 * shopping list as separate rows. normaliseIngredientName resolves those, and
 * the common UK/US synonyms besides.
 *
 * The key is the canonical name; the *display* name is whatever the first
 * occurrence used. Showing the canonical form would mean writing "beef mince"
 * onto a list where the user wrote "93/7 ground beef", which is a worse answer
 * than leaving their own words alone.
 *
 * An ingredient whose name normalises to nothing (a stray "2" or "*") keeps its
 * raw name as the key, so it stays a row of its own rather than collapsing
 * every unnameable item into one.
 */
export function aggregateIngredients(
  raw: Array<{ name: string; quantity: number | null; unit: string | null }>,
): MealPlanIngredient[] {
  // Grouped by canonical name ALONE. Keying on name+unit — which is what this
  // did before — puts "salt, 6 g" and "salt, a sprinkle" in separate buckets
  // and produces two salt lines, because one has a unit and the other doesn't.
  // In a shop you want one line per thing you are buying, and whether some of
  // it was measured in grams is not a reason to write it down twice.
  const groups = new Map<string, {
    displayName: string;
    // Summed quantity per unit. "" is the bucket for entries with no unit.
    byUnit: Map<string, number>;
    // True when at least one entry had no quantity at all ("a sprinkle").
    hasUnquantified: boolean;
  }>();

  for (const ing of raw) {
    const { quantity: normQty, unit: normUnit } = normaliseUnit(ing.quantity, ing.unit);
    const canonical = normaliseIngredientName(ing.name);
    const key = canonical || ing.name.toLowerCase().trim();

    const group = groups.get(key) ?? {
      displayName: ing.name.trim(),
      byUnit: new Map<string, number>(),
      hasUnquantified: false,
    };

    // Shortest original name wins as the label: "salt" reads better on a list
    // than "salt, a sprinkle", and the longer one is usually a preparation note
    // rather than a different ingredient.
    if (ing.name.trim().length < group.displayName.length) {
      group.displayName = ing.name.trim();
    }

    if (normQty === null) {
      group.hasUnquantified = true;
    } else {
      const unitKey = normUnit ?? "";
      group.byUnit.set(unitKey, (group.byUnit.get(unitKey) ?? 0) + normQty);
    }

    groups.set(key, group);
  }

  return Array.from(groups.values()).map((group) => {
    // The unit carrying the most measured entries is the one the line is
    // expressed in. Anything left over is mentioned rather than dropped —
    // silently losing "200 ml" because the line is already in grams would be
    // the same class of error as the duplicate it replaces.
    const units = [...group.byUnit.entries()].sort((a, b) => b[1] - a[1]);
    const [primary, ...rest] = units;

    const extras: string[] = rest.map(([unit, qty]) =>
      unit ? `${formatQuantity(qty)} ${unit}` : formatQuantity(qty),
    );
    if (group.hasUnquantified && primary) extras.push("plus a little more");

    const suffix = extras.length > 0 ? ` (+ ${extras.join(", ")})` : "";

    return {
      name: group.displayName + suffix,
      quantity: primary ? primary[1] : null,
      unit: primary ? (primary[0] || null) : null,
    };
  });
}

/** Trims float noise: 1.5 stays 1.5, 2.0000000000000004 becomes 2. */
function formatQuantity(n: number): string {
  return String(Math.round(n * 100) / 100);
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
      servings:      mealPlanEntries.servings,
      recipeTitle:   recipes.title,
      recipeImageUrl: recipes.imageUrl,
      recipeServings: recipes.servings,
    })
    .from(mealPlanEntries)
    .innerJoin(recipes, eq(mealPlanEntries.recipeId, recipes.id))
    .where(eq(mealPlanEntries.mealPlanId, planId));

  const entries = rows.map((row) => ({
    id:         row.id,
    mealPlanId: row.mealPlanId,
    recipeId:   row.recipeId,
    dayOfWeek:  row.dayOfWeek,
    mealType:   row.mealType,
    servings:   row.servings,
    recipe: {
      id:       row.recipeId,
      title:    row.recipeTitle,
      imageUrl: row.recipeImageUrl,
      servings: row.recipeServings,
    },
  }));

  // Sort explicitly. Postgres makes no ordering promise without ORDER BY, so
  // without this a day's list could reshuffle between loads — which looks like
  // a bug to anyone glancing at their week.
  //
  // Day, then meal type, then id. The id tiebreaker keeps two untagged entries
  // on the same day in a stable order rather than an arbitrary one.
  return entries.sort((a, b) => {
    const day = Number(a.dayOfWeek) - Number(b.dayOfWeek);
    if (day !== 0) return day;
    const meal = mealTypeRank(a.mealType) - mealTypeRank(b.mealType);
    if (meal !== 0) return meal;
    return a.id.localeCompare(b.id);
  });
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
      mealType:   input.mealType ?? null,
      servings:   input.servings ?? null,
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

/**
 * Deletes an entry, but only from a plan the caller is entitled to.
 *
 * Both ids arrive from the request path, so scoping the delete to
 * `entryId AND planId` proves only that the two are related — not that either
 * belongs to the caller. Without the ownership check below, any user could
 * delete any entry from anyone's meal plan given the two ids.
 *
 * Ownership mirrors getOrCreateMealPlan: a plan belongs to a household when one
 * exists, otherwise to the user directly. Checking only `userId` would break
 * households, where a plan created by one member is edited by another.
 */
export async function deleteMealPlanEntry(
  entryId: string,
  planId: string,
  userId: string,
  householdId: string | null,
): Promise<boolean> {
  const db = await getDb();

  const ownershipWhere = householdId
    ? and(eq(mealPlans.id, planId), eq(mealPlans.householdId, householdId))
    : and(eq(mealPlans.id, planId), eq(mealPlans.userId, userId), isNull(mealPlans.householdId));

  const [plan] = await db.select({ id: mealPlans.id }).from(mealPlans).where(ownershipWhere);
  if (!plan) return false;

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
 * Ingredients across a whole meal plan, scaled per entry, unit-normalised and
 * merged. Verifies the plan belongs to the user or their household.
 *
 * Two things this deliberately does per *entry* rather than per recipe:
 *
 *   Scaling. An entry may specify how many people it's being cooked for. A
 *   recipe written for 8 planned for 2 contributes a quarter of its
 *   quantities — without this the shopping list is simply wrong, by a factor
 *   of however far apart the two numbers are.
 *
 *   Repetition. The same recipe planned on Tuesday and again on Friday needs
 *   buying twice. This previously deduplicated recipe ids before fetching
 *   ingredients, so a recipe cooked twice in a week was shopped for once.
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

  // Recipe servings comes along so the scale factor can be computed per entry
  const entries = await db
    .select({
      recipeId: mealPlanEntries.recipeId,
      servings: mealPlanEntries.servings,
      recipeServings: recipes.servings,
    })
    .from(mealPlanEntries)
    .innerJoin(recipes, eq(mealPlanEntries.recipeId, recipes.id))
    .where(eq(mealPlanEntries.mealPlanId, planId));

  if (entries.length === 0) return [];

  const recipeIds = [...new Set(entries.map((e) => e.recipeId))];

  const raw = await db
    .select({
      recipeId: recipeIngredients.recipeId,
      name:     recipeIngredients.name,
      quantity: recipeIngredients.quantity,
      unit:     recipeIngredients.unit,
    })
    .from(recipeIngredients)
    .where(inArray(recipeIngredients.recipeId, recipeIds));

  const byRecipe = new Map<string, typeof raw>();
  for (const row of raw) {
    const list = byRecipe.get(row.recipeId) ?? [];
    list.push(row);
    byRecipe.set(row.recipeId, list);
  }

  // One pass per entry, so a repeated recipe contributes once per appearance
  const scaled: Array<{ name: string; quantity: number | null; unit: string | null }> = [];
  for (const entry of entries) {
    const ingredients = byRecipe.get(entry.recipeId) ?? [];

    // Guard the denominator: a recipe with 0 or null servings would otherwise
    // produce Infinity or NaN quantities, which propagate silently through the
    // sum and end up on the list as a blank or nonsensical figure.
    const factor =
      entry.servings && entry.recipeServings && entry.recipeServings > 0
        ? entry.servings / entry.recipeServings
        : 1;

    for (const ing of ingredients) {
      scaled.push({
        name: ing.name,
        quantity: ing.quantity !== null ? ing.quantity * factor : null,
        unit: ing.unit,
      });
    }
  }

  return aggregateIngredients(scaled);
}
