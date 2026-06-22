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
} from "../db/queries/mealplan-queries";

// ── Schemas ───────────────────────────────────────────────────────────────────

const CreateEntrySchema = z.object({
  recipeId: z.string().uuid(),
  dayOfWeek: z.union([
    z.literal(0), z.literal(1), z.literal(2), z.literal(3),
    z.literal(4), z.literal(5), z.literal(6),
  ]),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
});

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
