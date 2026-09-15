import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { validateAuth } from "../middleware/auth";
import { handleError, okResponse, NotFoundError, BadRequestError } from "../middleware/errors";
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
  updateCollectionRecipes,
  removeRecipeFromCollection,
  getCollectionsForRecipe,
} from "../db/queries/collection-queries";
import {
  getCollectionAccess,
  listCollectionShares,
  notifyCollectionShared,
  revokeCollectionShare,
  shareCollection,
} from "../db/queries/collection-share-queries";
import { collections } from "../db/schema";
import { getDb } from "../db/client";
import { eq } from "drizzle-orm";

// ── Validation schemas ─────────────────────────────────────────────────────────

const CreateCollectionSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).nullable().optional(),
  isPublic: z.boolean().optional(),
});

const UpdateCollectionSchema = CreateCollectionSchema.partial();

/**
 * Exactly one target, mirroring the CHECK constraint on the table. Refined
 * rather than expressed as a union so the error says which rule was broken.
 */
const ShareCollectionSchema = z
  .object({
    userId: z.string().uuid().optional(),
    householdId: z.string().uuid().optional(),
    role: z.enum(["viewer", "editor"]).default("viewer"),
  })
  .refine(
    (v) => Boolean(v.userId) !== Boolean(v.householdId),
    { message: "Provide exactly one of userId or householdId" },
  );

const ListPublicQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
});

// Capped at 200 per direction. The picker sends a diff rather than a full set,
// so a legitimate batch is small; a much larger one means a client bug or an
// attempt to make one request do an unbounded amount of work.
const UpdateCollectionRecipesSchema = z.object({
  add: z.array(z.string().uuid()).max(200).optional().default([]),
  remove: z.array(z.string().uuid()).max(200).optional().default([]),
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

    // GET /collections/for-recipe/{recipeId} — which collections contain this recipe
    // MUST come before the generic `GET /collections` check below: this route has no
    // {id} path param, so `collectionId` is undefined and the list handler would
    // otherwise swallow it and return the collection list instead.
    if (method === "GET" && rawPath.includes("/for-recipe/") && recipeId) {
      const collectionIds = await getCollectionsForRecipe(recipeId, user.id);
      return okResponse({ collectionIds });
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

    // PATCH /collections/{id}/recipes — bulk membership change
    //
    // Before the PATCH /collections/{id} check above? No — that one already
    // excludes paths containing "/recipes", so this is reachable. Keeping it
    // here, adjacent to the other membership routes, rather than relying on
    // that exclusion staying in place.
    if (method === "PATCH" && collectionId && rawPath.endsWith("/recipes")) {
      const body = parseBody(event.body, UpdateCollectionRecipesSchema);
      // parseBody's signature ties the schema's input and output types together,
      // so Zod's `.default([])` doesn't narrow away the undefined here.
      const result = await updateCollectionRecipes(collectionId, user.id, {
        add: body.add ?? [],
        remove: body.remove ?? [],
      });
      if (!result) throw new NotFoundError("Collection not found");
      return okResponse(result);
    }

    // GET /collections/{id}/shares — owner only.
    //
    // Must precede the generic GET /collections/{id} below, which matches any
    // path with an id bound. This is the same trap that made
    // /collections/for-recipe unreachable in PR #126.
    if (method === "GET" && collectionId && rawPath.endsWith("/shares")) {
      const access = await getCollectionAccess(collectionId, user.id);
      // Who else can see a collection is the owner's business. A viewer asking
      // gets the same answer as a stranger.
      if (access !== "owner") throw new NotFoundError("Collection not found");
      const shares = await listCollectionShares(collectionId);
      return okResponse({ shares });
    }

    // POST /collections/{id}/shares — owner only
    if (method === "POST" && collectionId && rawPath.endsWith("/shares")) {
      const access = await getCollectionAccess(collectionId, user.id);
      // Only the owner may widen access. An editor re-sharing would let a
      // grant enlarge itself, which is the one thing a share must never do.
      if (access !== "owner") throw new NotFoundError("Collection not found");

      const body = parseBody(event.body, ShareCollectionSchema);
      // parseBody types as the schema's *input*, where a .default() field is
      // still optional, so the default has to be reapplied here. Same inference
      // gap that bit the meal plan entry schema.
      const role = body.role ?? "viewer";
      const share = await shareCollection({
        collectionId,
        ownerId: user.id,
        targetUserId: body.userId ?? null,
        targetHouseholdId: body.householdId ?? null,
        role,
      });
      // Null means sharing with yourself, which is a no-op rather than an
      // error — the outcome the user wanted is already true.
      if (!share) return okResponse(null, 204);

      const db = await getDb();
      const [collection] = await db
        .select({ name: collections.name })
        .from(collections)
        .where(eq(collections.id, collectionId))
        .limit(1);

      try {
        await notifyCollectionShared({
          collectionId,
          collectionName: collection?.name ?? "a collection",
          ownerId: user.id,
          ownerName: user.displayName,
          targetUserId: body.userId ?? null,
          targetHouseholdId: body.householdId ?? null,
          role,
        });
      } catch (err) {
        // The share succeeded; a failed notification must not undo it or turn
        // a success into an error the user will retry.
        console.error("Failed to notify collection share:", err);
      }

      return okResponse(share, 201);
    }

    // DELETE /collections/{id}/shares/{shareId} — owner only
    const revokeMatch = rawPath.match(/\/shares\/([^/]+)$/);
    if (method === "DELETE" && collectionId && revokeMatch) {
      const access = await getCollectionAccess(collectionId, user.id);
      if (access !== "owner") throw new NotFoundError("Collection not found");
      const removed = await revokeCollectionShare(collectionId, revokeMatch[1]!);
      if (!removed) throw new NotFoundError("Share not found");
      return okResponse(null, 204);
    }

    // POST /collections/{id}/recipes/{recipeId} — add recipe to collection
    if (method === "POST" && collectionId && recipeId) {
      const result = await addRecipeToCollection(collectionId, recipeId, user.id);
      if (!result.added) {
        if (result.reason === "editor-cannot-publish") {
          throw new BadRequestError(
            "This collection is public, so only its owner can add recipes to it — " +
              "adding one would publish it.",
          );
        }
        if (result.reason === "not-your-recipe") {
          throw new BadRequestError("You can only add your own recipes to a collection.");
        }
        throw new NotFoundError("Collection not found");
      }
      return okResponse(null, 204);
    }

    // DELETE /collections/{id}/recipes/{recipeId} — remove recipe from collection
    if (method === "DELETE" && collectionId && recipeId) {
      const removed = await removeRecipeFromCollection(collectionId, recipeId, user.id);
      if (!removed) throw new NotFoundError("Item not found");
      return okResponse(null, 204);
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
