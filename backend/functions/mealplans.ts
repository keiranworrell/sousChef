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

      // getMealPlanIngredients now returns deduplicated, unit-normalised ingredients
      let aggregated = await getMealPlanIngredients(planId, user.id, householdId);
      if (aggregated === null) throw new NotFoundError("Meal plan not found");

      // Optionally deduct pantry quantities
      if (body.deductPantry && aggregated.length > 0) {
        const pantry = await listPantryItems(user.id, householdId);
        aggregated = aggregated.flatMap((item) => {
          const match = pantry.find(
            (p) =>
              p.name.toLowerCase().trim() === item.name.toLowerCase().trim() &&
              (p.unit ?? "").toLowerCase().trim() === (item.unit ?? "").toLowerCase().trim(),
          );
          if (!match || match.quantity === null) return [item];
          if (item.quantity === null) return [item];
          const remaining = item.quantity - match.quantity;
          if (remaining <= 0) return [];
          return [{ ...item, quantity: remaining }];
        });
      }

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
