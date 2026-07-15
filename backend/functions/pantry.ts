import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { validateAuth } from "../middleware/auth";
import { handleError, okResponse, NotFoundError } from "../middleware/errors";
import { parseBody } from "../middleware/validation";
import { getUserByCognitoId } from "../db/queries/user-queries";
import { getUserHouseholdId } from "../db/queries/household-queries";
import {
  listPantryItems,
  createPantryItem,
  updatePantryItem,
  deletePantryItem,
} from "../db/queries/pantry-queries";

// ── Validation schemas ─────────────────────────────────────────────────────────

const CreatePantryItemSchema = z.object({
  name: z.string().min(1).max(255),
  quantity: z.number().nonnegative().nullable().optional(),
  unit: z.string().max(50).nullable().optional(),
  expiryDate: z.string().datetime().nullable().optional(),
  lowStockThreshold: z.number().nonnegative().nullable().optional(),
});

const UpdatePantryItemSchema = CreatePantryItemSchema.partial();

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
    const itemId = event.pathParameters?.["id"];

    // GET /pantry
    if (method === "GET" && !itemId) {
      const items = await listPantryItems(user.id, householdId);
      return okResponse({ items });
    }

    // POST /pantry
    if (method === "POST" && !itemId) {
      const body = parseBody(event.body, CreatePantryItemSchema);
      const item = await createPantryItem({
        ...body,
        userId: user.id,
        householdId,
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
      });
      return okResponse(item, 201);
    }

    // PATCH /pantry/{id}
    if (method === "PATCH" && itemId) {
      const body = parseBody(event.body, UpdatePantryItemSchema);
      const { expiryDate, ...rest } = body;
      const item = await updatePantryItem(itemId, user.id, householdId, {
        ...rest,
        ...(expiryDate !== undefined
          ? { expiryDate: expiryDate ? new Date(expiryDate) : null }
          : {}),
      });
      if (!item) throw new NotFoundError("Pantry item not found");
      return okResponse(item);
    }

    // DELETE /pantry/{id}
    if (method === "DELETE" && itemId) {
      const deleted = await deletePantryItem(itemId, user.id, householdId);
      if (!deleted) throw new NotFoundError("Pantry item not found");
      return okResponse(null, 204);
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
