import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { validateAuth } from "../middleware/auth";
import { handleError, okResponse, NotFoundError } from "../middleware/errors";
import { getUserByCognitoId } from "../db/queries/user-queries";

const CommunityListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
  cursor: z.string().max(500).optional(),
  sort: z.enum(["popular"]).optional(),
  q: z.string().max(200).optional(),
  cuisine: z.string().optional(),
  tag: z.string().optional(),
  creator: z.string().optional(),
  creatorId: z.string().uuid().optional(),
});
import {
  listPublicRecipes,
  getPublicRecipe,
  forkRecipe,
  likeRecipe,
  unlikeRecipe,
} from "../db/queries/community-queries";

// ── Handler ────────────────────────────────────────────────────────────────────

export const handler: APIGatewayProxyHandlerV2 = async (
  event,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const method = event.requestContext.http.method.toUpperCase();
    const path = event.rawPath ?? "";

    // GET /public/recipes/{id} — no auth required
    const publicDetailMatch = path.match(/\/public\/recipes\/([^/]+)$/);
    if (publicDetailMatch && method === "GET") {
      const recipeId = publicDetailMatch[1]!;
      const recipe = await getPublicRecipe(recipeId, "anonymous");
      if (!recipe) throw new NotFoundError("Recipe not found");
      return okResponse(recipe);
    }

    const auth = await validateAuth(event);
    const user = await getUserByCognitoId(auth.cognitoId);
    if (!user) throw new NotFoundError("User not found");

    // POST /community/recipes/{id}/like  — must come before /{id} and /{id}/fork
    const likeMatch = path.match(/\/community\/recipes\/([^/]+)\/like$/);
    if (likeMatch && method === "POST") {
      await likeRecipe(user.id, likeMatch[1]!);
      return okResponse(null, 204);
    }
    if (likeMatch && method === "DELETE") {
      await unlikeRecipe(user.id, likeMatch[1]!);
      return okResponse(null, 204);
    }

    // POST /community/recipes/{id}/fork
    const forkMatch = path.match(/\/community\/recipes\/([^/]+)\/fork$/);
    if (forkMatch && method === "POST") {
      const recipeId = forkMatch[1]!;
      const forked = await forkRecipe(recipeId, user.id);
      return okResponse(forked, 201);
    }

    // GET /community/recipes/{id}
    const detailMatch = path.match(/\/community\/recipes\/([^/]+)$/);
    if (detailMatch && method === "GET") {
      const recipeId = detailMatch[1]!;
      const recipe = await getPublicRecipe(recipeId, user.id);
      if (!recipe) throw new NotFoundError("Recipe not found");
      return okResponse(recipe);
    }

    // GET /community/recipes
    if (method === "GET" && path.endsWith("/community/recipes")) {
      const query = CommunityListQuerySchema.parse(event.queryStringParameters ?? {});
      const result = await listPublicRecipes({
        userId: user.id,
        q: query.q ?? null,
        cuisine: query.cuisine ?? null,
        tag: query.tag ?? null,
        creator: query.creator ?? null,
        creatorId: query.creatorId ?? null,
        sort: query.sort ?? null,
        limit: query.limit,
        cursor: query.cursor ?? null,
      });
      return okResponse(result);
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
