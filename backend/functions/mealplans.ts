import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { validateAuth } from "../middleware/auth";
import { handleError, okResponse, NotFoundError } from "../middleware/errors";
import { parseBody } from "../middleware/validation";
import { getUserByCognitoId } from "../db/queries/user-queries";
import { getUserHouseholdId } from "../db/queries/household-queries";
import {
  getOrCreateMealPlan,
  createMealPlanEntry,
  deleteMealPlanEntry,
  getWeekStart,
  getMealPlanIngredients,
} from "../db/queries/mealplan-queries";
import { createShoppingListWithItems } from "../db/queries/shopping-queries";

// ── Schemas ───────────────────────────────────────────────────────────────────

const CreateEntrySchema = z.object({
  recipeId: z.string().uuid(),
  dayOfWeek: z.union([
    z.literal(0), z.literal(1), z.literal(2), z.literal(3),
    z.literal(4), z.literal(5), z.literal(6),
  ]),
  // Optional label rather than a required slot — a day holds any number of
  // recipes, and tagging one is a convenience.
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).nullable().optional(),
  // Omitted means "cook it as written" — distinct from matching the recipe's
  // own servings, so it is nullable rather than defaulted.
  servings: z.number().int().positive().max(100).nullable().optional(),
});

const GenerateShoppingListSchema = z.object({
  name: z.string().min(1).max(255).optional(),
});

// ── Handler ────────────────────────────────────────────────────────────────────

export const handler: APIGatewayProxyHandlerV2 = async (
  event,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const auth = await validateAuth(event);
    const user = await getUserByCognitoId(auth.cognitoId);
    if (!user) throw new NotFoundError("User not found");

    const householdId = await getUserHouseholdId(user.id);

    const method = event.requestContext.http.method.toUpperCase();
    const path = event.rawPath ?? "";

    // DELETE /meal-plans/{planId}/entries/{entryId}
    const deleteMatch = path.match(/\/meal-plans\/([^/]+)\/entries\/([^/]+)$/);
    if (deleteMatch && method === "DELETE") {
      const [, planId, entryId] = deleteMatch;
      const deleted = await deleteMealPlanEntry(entryId!, planId!, user.id, householdId);
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

      // getMealPlanIngredients now returns deduplicated, unit-normalised ingredients
      const aggregated = await getMealPlanIngredients(planId, user.id, householdId);
      if (aggregated === null) throw new NotFoundError("Meal plan not found");

      const listName = body.name ?? "Meal plan shopping list";
      const list = await createShoppingListWithItems({
        userId: user.id,
        householdId,
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
      const plan = await getOrCreateMealPlan(user.id, householdId, weekStart);
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
