import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { validateAuth } from "../middleware/auth";
import { handleError, okResponse, NotFoundError } from "../middleware/errors";
import { parseBody } from "../middleware/validation";
import { getUserByCognitoId } from "../db/queries/user-queries";
import {
  getOrCreateMealPlan,
  createMealPlanEntry,
  deleteMealPlanEntry,
  getWeekStart,
  getMealPlanIngredients,
  type MealPlanIngredient,
} from "../db/queries/mealplan-queries";
import { listPantryItems } from "../db/queries/pantry-queries";
import { createShoppingListWithItems } from "../db/queries/shopping-queries";

// ── Schemas ───────────────────────────────────────────────────────────────────

const CreateEntrySchema = z.object({
  recipeId: z.string().uuid(),
  dayOfWeek: z.union([
    z.literal(0), z.literal(1), z.literal(2), z.literal(3),
    z.literal(4), z.literal(5), z.literal(6),
  ]),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
});

const GenerateShoppingListSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  deductPantry: z.boolean().optional().default(false),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Aggregate a flat list of recipe ingredients into deduplicated shopping items.
 * Groups by (normalised name, normalised unit), summing quantities where possible.
 */
function aggregateIngredients(
  ingredients: MealPlanIngredient[],
): Array<{ name: string; quantity: number | null; unit: string | null }> {
  // Group by ingredient name (case-insensitive). Within each group, sum quantities
  // when all entries share the same unit. When units differ, drop quantity/unit so
  // the user at least gets a single line item for the ingredient.
  type Entry = { name: string; quantity: number | null; unit: string | null };
  const map = new Map<string, Entry[]>();

  for (const ing of ingredients) {
    const nameKey = ing.name.toLowerCase().trim();
    const entries = map.get(nameKey);
    if (entries) {
      entries.push({ name: ing.name, quantity: ing.quantity, unit: ing.unit ?? null });
    } else {
      map.set(nameKey, [{ name: ing.name, quantity: ing.quantity, unit: ing.unit ?? null }]);
    }
  }

  return Array.from(map.values()).map((entries) => {
    const first = entries[0]!;
    if (entries.length === 1) return first;

    const units = new Set(entries.map((e) => (e.unit ?? "").toLowerCase().trim()));

    if (units.size === 1) {
      // All same unit — sum quantities (null if any is unknown)
      const total = entries.reduce<number | null>((acc, e) => {
        if (acc === null || e.quantity === null) return null;
        return acc + e.quantity;
      }, 0);
      return { name: first.name, quantity: total, unit: first.unit };
    }

    // Mixed units — can't safely sum; return the ingredient with no quantity/unit
    return { name: first.name, quantity: null, unit: null };
  });
}

// ── Handler ────────────────────────────────────────────────────────────────────

export const handler: APIGatewayProxyHandlerV2 = async (
  event,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const auth = await validateAuth(event);
    const user = await getUserByCognitoId(auth.cognitoId);
    if (!user) throw new NotFoundError("User not found");

    const method = event.requestContext.http.method.toUpperCase();
    const path = event.rawPath ?? "";

    // DELETE /meal-plans/{planId}/entries/{entryId}
    const deleteMatch = path.match(/\/meal-plans\/([^/]+)\/entries\/([^/]+)$/);
    if (deleteMatch && method === "DELETE") {
      const [, planId, entryId] = deleteMatch;
      const deleted = await deleteMealPlanEntry(entryId!, planId!);
      if (!deleted) throw new NotFoundError("Entry not found");
      return okResponse(null, 204);
    }

    // POST /meal-plans/{planId}/entries
    const createEntryMatch = path.match(/\/meal-plans\/([^/]+)\/entries$/);
    if (createEntryMatch && method === "POST") {
      const [, planId] = createEntryMatch;
      const body = parseBody(event.body, CreateEntrySchema);
      const entry = await createMealPlanEntry({ ...body, mealPlanId: planId! });
      return okResponse(entry, 201);
    }

    // POST /meal-plans/{planId}/shopping-list
    const shoppingListMatch = path.match(/\/meal-plans\/([^/]+)\/shopping-list$/);
    if (shoppingListMatch && method === "POST") {
      const planId = shoppingListMatch[1]!;
      const body = parseBody(event.body, GenerateShoppingListSchema);

      const rawIngredients = await getMealPlanIngredients(planId, user.id);
      if (rawIngredients === null) throw new NotFoundError("Meal plan not found");

      let aggregated = aggregateIngredients(rawIngredients);

      // Optionally deduct pantry quantities
      if (body.deductPantry && aggregated.length > 0) {
        const pantryItems = await listPantryItems(user.id);
        aggregated = aggregated.flatMap((item) => {
          const match = pantryItems.find(
            (p) => p.name.toLowerCase().trim() === item.name.toLowerCase().trim()
              && (p.unit ?? "").toLowerCase().trim() === (item.unit ?? "").toLowerCase().trim(),
          );
          if (!match || match.quantity === null) return [item];
          if (item.quantity === null) return [item]; // can't subtract from unknown qty
          const remaining = item.quantity - match.quantity;
          if (remaining <= 0) return []; // already have enough — omit
          return [{ ...item, quantity: remaining }];
        });
      }

      const listName = body.name ?? "Meal plan shopping list";
      const list = await createShoppingListWithItems({
        userId: user.id,
        name: listName,
        items: aggregated,
      });

      return okResponse(list, 201);
    }

    // GET /meal-plans — returns the plan for the requested week (defaults to current)
    if (method === "GET" && path.endsWith("/meal-plans")) {
      const weekStartParam = event.queryStringParameters?.["weekStart"];
      const weekStart = getWeekStart(
        weekStartParam ? new Date(weekStartParam) : new Date(),
      );
      const plan = await getOrCreateMealPlan(user.id, weekStart);
      return okResponse(plan);
    }

    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" },
      }),
    };
  } catch (err) {
    return handleError(err);
  }
};
