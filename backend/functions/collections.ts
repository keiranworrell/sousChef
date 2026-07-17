import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { validateAuth } from "../middleware/auth";
import { handleError, okResponse, NotFoundError } from "../middleware/errors";
import { parseBody } from "../middleware/validation";
import { getUserByCognitoId } from "../db/queries/user-queries";
import {
  listCollections,
  getCollectionById,
  getPublicCollectionById,
  listPublicCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  addRecipeToCollection,
  removeRecipeFromCollection,
  getCollectionsForRecipe,
} from "../db/queries/collection-queries";

// ── Validation schemas ─────────────────────────────────────────────────────────

const CreateCollectionSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).nullable().optional(),
  isPublic: z.boolean().optional(),
});

const UpdateCollectionSchema = CreateCollectionSchema.partial();

const ListPublicQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
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
    const rawPath = event.rawPath ?? "";
    const collectionId = event.pathParameters?.["id"];
    const recipeId = event.pathParameters?.["recipeId"];

    // GET /collections/public — list public collections (community browse)
    if (method === "GET" && rawPath.endsWith("/public")) {
      const query = ListPublicQuerySchema.parse(event.queryStringParameters ?? {});
      const result = await listPublicCollections(query);
      return okResponse({ ...result, limit: query.limit, offset: query.offset });
    }

    // GET /collections/public/{id} — get a single public collection
    if (method === "GET" && rawPath.includes("/public/") && collectionId) {
      const collection = await getPublicCollectionById(collectionId);
      if (!collection) throw new NotFoundError("Collection not found");
      return okResponse(collection);
    }

    // GET /collections — list current user's collections
    if (method === "GET" && !collectionId) {
      const result = await listCollections(user.id);
      return okResponse({ collections: result });
    }

    // POST /collections — create a new collection
    if (method === "POST" && !collectionId) {
      const body = parseBody(event.body, CreateCollectionSchema);
      const collection = await createCollection({ ...body, userId: user.id });
      return okResponse(collection, 201);
    }

    // GET /collections/{id} — get collection with items
    if (method === "GET" && collectionId && !rawPath.includes("/recipes")) {
      const collection = await getCollectionById(collectionId, user.id);
      if (!collection) throw new NotFoundError("Collection not found");
      return okResponse(collection);
    }

    // PATCH /collections/{id} — update collection (name, description, isPublic)
    if (method === "PATCH" && collectionId && !rawPath.includes("/recipes")) {
      const body = parseBody(event.body, UpdateCollectionSchema);
      const collection = await updateCollection(collectionId, user.id, body);
      if (!collection) throw new NotFoundError("Collection not found");
      return okResponse(collection);
    }

    // DELETE /collections/{id} — delete collection
    if (method === "DELETE" && collectionId && !rawPath.includes("/recipes")) {
      const deleted = await deleteCollection(collectionId, user.id);
      if (!deleted) throw new NotFoundError("Collection not found");
      return okResponse(null, 204);
    }

    // POST /collections/{id}/recipes/{recipeId} — add recipe to collection
    if (method === "POST" && collectionId && recipeId) {
      const result = await addRecipeToCollection(collectionId, recipeId, user.id);
      if (!result.added) throw new NotFoundError("Collection not found");
      return okResponse(null, 204);
    }

    // DELETE /collections/{id}/recipes/{recipeId} — remove recipe from collection
    if (method === "DELETE" && collectionId && recipeId) {
      const removed = await removeRecipeFromCollection(collectionId, recipeId, user.id);
      if (!removed) throw new NotFoundError("Item not found");
      return okResponse(null, 204);
    }

    // GET /collections/for-recipe/{recipeId} — which collections contain this recipe
    if (method === "GET" && rawPath.includes("/for-recipe/") && recipeId) {
      const collectionIds = await getCollectionsForRecipe(recipeId, user.id);
      return okResponse({ collectionIds });
    }

    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } }),
    };
  } catch (err) {
    return handleError(err);
  }
};
