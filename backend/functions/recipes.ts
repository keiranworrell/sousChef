import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { validateAuth } from "../middleware/auth";
import { handleError, okResponse, NotFoundError, assertPremium } from "../middleware/errors";
import { parseBody } from "../middleware/validation";
import { getUserByCognitoId } from "../db/queries/user-queries";
import {
  listRecipes,
  getRecipeById,
  createRecipe,
  updateRecipe,
  deleteRecipe,
} from "../db/queries/recipe-queries";
import { importRecipeFromUrl, fetchPageHtml, parseRecipeFromHtml } from "../agents/recipe-import";
import { importRecipeWithAi, importRecipeFromText } from "../agents/recipe-import-ai";
import { logCook, getCookHistory } from "../db/queries/cook-history-queries";
import { getRediscoverRecipes } from "../db/queries/rediscover-queries";

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

const ImportRecipeSchema = z.object({
  url: z.string().url(),
});

const ImportRecipeTextSchema = z.object({
  text: z.string().min(1).max(50_000),
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

const UpdateRecipeSchema = CreateRecipeSchema.partial();

const ListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
  tag: z.string().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  sort: z.enum(["newest", "oldest", "title"]).optional(),
});


const CookHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
});

const RediscoverQuerySchema = z.object({
  mode: z.enum(["cook-again", "never-tried"]).default("cook-again"),
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

    // GET /recipes/cook-history — must come before generic GET /recipes check
    // because API Gateway sets no recipeId for this route
    if (method === "GET" && event.rawPath?.endsWith("/cook-history")) {
      const query = CookHistoryQuerySchema.parse(event.queryStringParameters ?? {});
      const result = await getCookHistory(user.id, query);
      return okResponse(result);
    }

    // GET /recipes/rediscover
    if (method === "GET" && event.rawPath?.endsWith("/rediscover")) {
      const { mode } = RediscoverQuerySchema.parse(event.queryStringParameters ?? {});
      const recipes = await getRediscoverRecipes(user.id, mode);
      return okResponse({ recipes, mode });
    }

    // POST /recipes/{id}/cook
    if (method === "POST" && recipeId && event.rawPath?.endsWith("/cook")) {
      const entry = await logCook(user.id, recipeId);
      return okResponse(entry, 201);
    }

    // GET /recipes
    if (method === "GET" && !recipeId) {
      const query = ListQuerySchema.parse(event.queryStringParameters ?? {});
      const result = await listRecipes(user.id, query);
      return okResponse(result);
    }

    // POST /recipes/import/ai — AI fallback, premium only, parse only, no save
    if (method === "POST" && event.rawPath?.endsWith("/import/ai")) {
      assertPremium(user.planTier);
      const body = parseBody(event.body, ImportRecipeSchema);

      // Fetch the HTML once
      const fetched = await fetchPageHtml(body.url);
      if (!fetched.ok) {
        return {
          statusCode: 422,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: { code: "IMPORT_FAILED", message: fetched.error } }),
        };
      }

      // Try Schema.org first — no AI call needed if it works
      const schemaResult = parseRecipeFromHtml(body.url, fetched.html);
      if (schemaResult.ok) {
        return okResponse(schemaResult.recipe);
      }

      // Schema.org failed — fall back to AI
      const aiResult = await importRecipeWithAi(body.url, fetched.html);
      if (!aiResult.ok) {
        return {
          statusCode: 422,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: { code: "AI_IMPORT_FAILED", message: aiResult.error } }),
        };
      }
      return okResponse(aiResult.recipe);
    }

    // POST /recipes/import/text — AI extract from pasted note, premium only, no save
    if (method === "POST" && event.rawPath?.endsWith("/import/text")) {
      assertPremium(user.planTier);
      const body = parseBody(event.body, ImportRecipeTextSchema);
      const result = await importRecipeFromText(body.text);
      if (!result.ok) {
        return {
          statusCode: 422,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: { code: "TEXT_IMPORT_FAILED", message: result.error } }),
        };
      }
      return okResponse(result.recipe);
    }

    // POST /recipes/import/parse — parse only, no save
    if (method === "POST" && event.rawPath?.endsWith("/import/parse")) {
      const body = parseBody(event.body, ImportRecipeSchema);
      const result = await importRecipeFromUrl(body.url);
      if (!result.ok) {
        return {
          statusCode: 422,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            error: { code: "IMPORT_FAILED", message: result.error },
          }),
        };
      }
      return okResponse(result.recipe);
    }

    // POST /recipes/import — parse and save
    if (method === "POST" && event.rawPath?.endsWith("/import")) {
      const body = parseBody(event.body, ImportRecipeSchema);
      const result = await importRecipeFromUrl(body.url);
      if (!result.ok) {
        return {
          statusCode: 422,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            error: { code: "IMPORT_FAILED", message: result.error },
          }),
        };
      }
      const recipe = await createRecipe({ ...result.recipe, userId: user.id });
      return okResponse(recipe, 201);
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
