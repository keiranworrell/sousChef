import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { validateAuth } from "../middleware/auth";
import { handleError, okResponse, NotFoundError } from "../middleware/errors";
import { parseBody } from "../middleware/validation";
import { getUserByCognitoId } from "../db/queries/user-queries";
import {
  listRecipes,
  getRecipeById,
  createRecipe,
  updateRecipe,
  deleteRecipe,
} from "../db/queries/recipe-queries";

// ── Validation schemas ─────────────────────────────────────────────────────────

const IngredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().positive().nullable().optional(),
  unit: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  orderIndex: z.number().int().nonnegative(),
});

const StepSchema = z.object({
  stepNumber: z.number().int().positive(),
  instruction: z.string().min(1),
  timerSeconds: z.number().int().positive().nullable().optional(),
});

const CreateRecipeSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  servings: z.number().int().positive().optional(),
  prepTimeMinutes: z.number().int().nonnegative().nullable().optional(),
  cookTimeMinutes: z.number().int().nonnegative().nullable().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).nullable().optional(),
  cuisine: z.string().nullable().optional(),
  isPublic: z.boolean().optional(),
  ingredients: z.array(IngredientSchema).optional(),
  steps: z.array(StepSchema).optional(),
  tags: z.array(z.string().min(1)).optional(),
});

const UpdateRecipeSchema = CreateRecipeSchema.partial().omit({
  ingredients: true,
  steps: true,
  tags: true,
});

const PaginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
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
    const recipeId = event.pathParameters?.["id"];

    // GET /recipes
    if (method === "GET" && !recipeId) {
      const query = PaginationSchema.parse(event.queryStringParameters ?? {});
      const result = await listRecipes(user.id, query.limit, query.offset);
      return okResponse(result);
    }

    // POST /recipes
    if (method === "POST" && !recipeId) {
      const body = parseBody(event.body, CreateRecipeSchema);
      const recipe = await createRecipe({ ...body, userId: user.id });
      return okResponse(recipe, 201);
    }

    // GET /recipes/{id}
    if (method === "GET" && recipeId) {
      const recipe = await getRecipeById(recipeId, user.id);
      if (!recipe) throw new NotFoundError("Recipe not found");
      return okResponse(recipe);
    }

    // PATCH /recipes/{id}
    if (method === "PATCH" && recipeId) {
      const body = parseBody(event.body, UpdateRecipeSchema);
      const recipe = await updateRecipe(recipeId, user.id, body);
      if (!recipe) throw new NotFoundError("Recipe not found");
      return okResponse(recipe);
    }

    // DELETE /recipes/{id}
    if (method === "DELETE" && recipeId) {
      const deleted = await deleteRecipe(recipeId, user.id);
      if (!deleted) throw new NotFoundError("Recipe not found");
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
