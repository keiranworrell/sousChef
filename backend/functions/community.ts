import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { validateAuth } from "../middleware/auth";
import { handleError, okResponse, NotFoundError } from "../middleware/errors";
import { getUserByCognitoId } from "../db/queries/user-queries";
import {
  listPublicRecipes,
  getPublicRecipe,
  forkRecipe,
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
      const recipe = await getPublicRecipe(recipeId);
      if (!recipe) throw new NotFoundError("Recipe not found");
      return okResponse(recipe);
    }

    const auth = await validateAuth(event);
    const user = await getUserByCognitoId(auth.cognitoId);
    if (!user) throw new NotFoundError("User not found");

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
      const recipe = await getPublicRecipe(recipeId);
      if (!recipe) throw new NotFoundError("Recipe not found");
      return okResponse(recipe);
    }

    // GET /community/recipes
    if (method === "GET" && path.endsWith("/community/recipes")) {
      const qs = event.queryStringParameters ?? {};
      const limit = Math.min(parseInt(qs["limit"] ?? "20", 10), 50);
      const offset = parseInt(qs["offset"] ?? "0", 10);
      const result = await listPublicRecipes({
        userId: user.id,
        q: qs["q"] ?? null,
        cuisine: qs["cuisine"] ?? null,
        tag: qs["tag"] ?? null,
        creator: qs["creator"] ?? null,
        limit,
        offset,
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
