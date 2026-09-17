import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { validateAuth } from "../middleware/auth";
import { handleError, okResponse, NotFoundError } from "../middleware/errors";
import { parseBody } from "../middleware/validation";
import { getUserByCognitoId } from "../db/queries/user-queries";
import { getUserHouseholdId } from "../db/queries/household-queries";
import {
  listShoppingLists,
  getShoppingListWithItems,
  createShoppingList,
  updateShoppingList,
  deleteShoppingList,
  createShoppingListItem,
  updateShoppingListItem,
  deleteShoppingListItem,
  getNextOrderIndex,
  completeShoppingList,
  bulkAddShoppingListItems,
  mergeShoppingListItems,
} from "../db/queries/shopping-queries";

// ── Schemas ───────────────────────────────────────────────────────────────────

const CreateListSchema = z.object({
  name: z.string().min(1).max(255),
});

const UpdateListSchema = z.object({
  name: z.string().min(1).max(255),
});

const CreateItemSchema = z.object({
  name: z.string().min(1).max(255),
  quantity: z.number().nonnegative().nullable().optional(),
  unit: z.string().max(50).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
});

const UpdateItemSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  quantity: z.number().nonnegative().nullable().optional(),
  unit: z.string().max(50).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  isChecked: z.boolean().optional(),
});

const BulkAddItemsSchema = z.object({
  items: z.array(z.object({
    name: z.string().min(1).max(255),
    quantity: z.number().nonnegative().nullable().optional(),
    unit: z.string().max(50).nullable().optional(),
  })).min(1),
});

/**
 * Two or more items become one, under a name the user picks.
 *
 * `min(2)` because merging one thing with nothing is not a merge, and the
 * query layer would reject it anyway — better to say so as a 422 naming the
 * field than as a 404 that reads like the list is missing.
 */
const MergeItemsSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(2).max(50),
  name: z.string().min(1).max(255),
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

    // POST /shopping/{listId}/items/bulk
    const bulkMatch = path.match(/\/shopping\/([^/]+)\/items\/bulk$/);
    if (bulkMatch && method === "POST") {
      const listId = bulkMatch[1]!;
      const list = await getShoppingListWithItems(listId, user.id, householdId);
      if (!list) throw new NotFoundError("Shopping list not found");
      const body = parseBody(event.body, BulkAddItemsSchema);
      const startIndex = await getNextOrderIndex(listId);
      const items = await bulkAddShoppingListItems(listId, body.items, startIndex);
      return okResponse(items, 201);
    }

    // POST /shopping/{listId}/items/merge
    //
    // Before the generic items block below, which would otherwise match this as
    // an itemId of "merge" — the same reason /items/bulk is handled up here.
    const mergeMatch = path.match(/\/shopping\/([^/]+)\/items\/merge$/);
    if (mergeMatch && method === "POST") {
      const listId = mergeMatch[1]!;
      const list = await getShoppingListWithItems(listId, user.id, householdId);
      if (!list) throw new NotFoundError("Shopping list not found");

      const body = parseBody(event.body, MergeItemsSchema);
      const merged = await mergeShoppingListItems(listId, body.itemIds, body.name);
      // Null covers both "an id isn't on this list" and "fewer than two given".
      // Zod has already rejected the second, so what's left is a caller sending
      // ids that aren't theirs, which gets not-found rather than a hint.
      if (!merged) throw new NotFoundError("Those items could not be merged");
      return okResponse(merged);
    }

    // Routes involving items: /shopping/{listId}/items[/{itemId}]
    const itemsMatch = path.match(/\/shopping\/([^/]+)\/items(?:\/([^/]+))?$/);
    if (itemsMatch) {
      const listId = itemsMatch[1]!;
      const itemId = itemsMatch[2];

      const list = await getShoppingListWithItems(listId, user.id, householdId);
      if (!list) throw new NotFoundError("Shopping list not found");

      // POST /shopping/{listId}/items
      if (method === "POST" && !itemId) {
        const body = parseBody(event.body, CreateItemSchema);
        const orderIndex = await getNextOrderIndex(listId);
        const item = await createShoppingListItem({ ...body, shoppingListId: listId, orderIndex });
        return okResponse(item, 201);
      }

      // PATCH /shopping/{listId}/items/{itemId}
      if (method === "PATCH" && itemId) {
        const body = parseBody(event.body, UpdateItemSchema);
        const item = await updateShoppingListItem(itemId, listId, body);
        if (!item) throw new NotFoundError("Item not found");
        return okResponse(item);
      }

      // DELETE /shopping/{listId}/items/{itemId}
      if (method === "DELETE" && itemId) {
        const deleted = await deleteShoppingListItem(itemId, listId);
        if (!deleted) throw new NotFoundError("Item not found");
        return okResponse(null, 204);
      }
    }

    // POST /shopping/{listId}/complete
    const completeMatch = path.match(/\/shopping\/([^/]+)\/complete$/);
    if (completeMatch && method === "POST") {
      const listId = completeMatch[1]!;
      const result = await completeShoppingList(listId, user.id, householdId);
      if (!result) throw new NotFoundError("Shopping list not found");
      return okResponse(result);
    }

    // Routes for lists: /shopping[/{listId}]
    const listId = event.pathParameters?.["listId"];

    // GET /shopping
    if (method === "GET" && !listId) {
      const lists = await listShoppingLists(user.id, householdId);
      return okResponse({ lists });
    }

    // POST /shopping
    if (method === "POST" && !listId) {
      const body = parseBody(event.body, CreateListSchema);
      const list = await createShoppingList({ ...body, userId: user.id, householdId });
      return okResponse(list, 201);
    }

    // GET /shopping/{listId}
    if (method === "GET" && listId) {
      const list = await getShoppingListWithItems(listId, user.id, householdId);
      if (!list) throw new NotFoundError("Shopping list not found");
      return okResponse(list);
    }

    // PATCH /shopping/{listId}
    if (method === "PATCH" && listId) {
      const body = parseBody(event.body, UpdateListSchema);
      const list = await updateShoppingList(listId, user.id, householdId, body);
      if (!list) throw new NotFoundError("Shopping list not found");
      return okResponse(list);
    }

    // DELETE /shopping/{listId}
    if (method === "DELETE" && listId) {
      const deleted = await deleteShoppingList(listId, user.id, householdId);
      if (!deleted) throw new NotFoundError("Shopping list not found");
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
