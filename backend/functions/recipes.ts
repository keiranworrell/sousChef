import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { z } from "zod";
import { validateAuth } from "../middleware/auth";
import {
  handleError,
  okResponse,
  NotFoundError,
  BadRequestError,
  assertAiImportAllowed,
} from "../middleware/errors";
import { parseBody } from "../middleware/validation";
import { getUserByCognitoId, incrementAiImportCount } from "../db/queries/user-queries";
import {
  listRecipes,
  getRecipeById,
  createRecipe,
  updateRecipe,
  deleteRecipe,
} from "../db/queries/recipe-queries";

const s3Client = new S3Client({});
const IMAGES_BUCKET_NAME = process.env["IMAGES_BUCKET_NAME"] ?? "";
const IMAGES_CLOUDFRONT_DOMAIN = process.env["IMAGES_CLOUDFRONT_DOMAIN"] ?? "";
import { importRecipeFromUrl, fetchPageHtml, parseRecipeFromHtml } from "../agents/recipe-import";
import { importRecipeWithAi, importRecipeFromText } from "../agents/recipe-import-ai";
import { importRecipeFromPhotos } from "../agents/recipe-import-photo";
import {
  logCook,
  getCookHistory,
  getRecipeCookLog,
  deleteCookLogEntry,
} from "../db/queries/cook-history-queries";
import { getRediscoverRecipes } from "../db/queries/rediscover-queries";
import { importRecipes } from "../db/queries/import-queries";
import { parseRecipeImport } from "@souschef/shared";

/**
 * Ceiling on one import. A Lambda has a wall-clock limit and these are
 * sequential writes, so a genuinely enormous file would time out halfway and
 * leave the user unsure what landed. Failing up front with a number in the
 * message beats a partial import with no report.
 */
const MAX_IMPORT_RECIPES = 500;

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
  // recipe_steps.image_url exists in the table but was absent here, so per-step
  // images were silently dropped — the same omission that lost sourceUrl.
  imageUrl: z.string().url().nullable().optional(),
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
  imageUrl: z.string().url().nullable().optional(),
  servings: z.number().int().positive().optional(),
  prepTimeMinutes: z.number().int().nonnegative().nullable().optional(),
  cookTimeMinutes: z.number().int().nonnegative().nullable().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).nullable().optional(),
  cuisine: z.string().nullable().optional(),
  isPublic: z.boolean().optional(),
  // Where an imported recipe came from. Was missing here, so Zod stripped it on
  // every create — meaning no client-imported recipe has ever carried
  // attribution, despite the agent extracting it and the column existing.
  //
  // Note `forkedFromId` is deliberately NOT accepted: it is set server-side by
  // forkRecipe, and letting a client claim a recipe was forked from an arbitrary
  // id would be a provenance lie rather than a convenience.
  sourceUrl: z.string().url().nullable().optional(),
  ingredients: z.array(IngredientSchema).optional(),
  steps: z.array(StepSchema).optional(),
  tags: z.array(z.string().min(1)).optional(),
});

const UpdateRecipeSchema = CreateRecipeSchema.partial();

const ListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  cursor: z.string().max(500).optional(),
  q: z.string().max(200).optional(),
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

// Every field is optional: a bare POST is still a valid "I cooked this" log,
// which is what the one-tap path sends.
const LogCookSchema = z.object({
  rating: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  cookedAt: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .nullable()
    .optional(),
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

    // GET /recipes/{id}/cook-history — this user's own log for one recipe.
    // Must be tested before the account-wide route below, which matches the same
    // suffix; the two are told apart by whether API Gateway bound an id.
    if (method === "GET" && recipeId && event.rawPath?.endsWith("/cook-history")) {
      const entries = await getRecipeCookLog(user.id, recipeId);
      return okResponse({ entries });
    }

    // DELETE /recipes/{id}/cook-history/{entryId}
    const deleteLogMatch = event.rawPath?.match(/\/cook-history\/([^/]+)$/);
    if (method === "DELETE" && deleteLogMatch) {
      const removed = await deleteCookLogEntry(user.id, deleteLogMatch[1]!);
      if (!removed) throw new NotFoundError("Cook log entry not found");
      return okResponse(null, 204);
    }

    // GET /recipes/cook-history — must come before generic GET /recipes check
    // because API Gateway sets no recipeId for this route
    if (method === "GET" && !recipeId && event.rawPath?.endsWith("/cook-history")) {
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
      const body = event.body ? parseBody(event.body, LogCookSchema) : {};
      const entry = await logCook(user.id, recipeId, body);
      if (!entry) throw new NotFoundError("Recipe not found");
      return okResponse(entry, 201);
    }

    // GET /recipes
    if (method === "GET" && !recipeId) {
      const query = ListQuerySchema.parse(event.queryStringParameters ?? {});
      const result = await listRecipes(user.id, query);
      return okResponse(result);
    }

    // POST /recipes/import/file — restore from a sousChef export.
    //
    // Free for everyone, unlike the AI imports. Getting your own data back into
    // the product is not a feature to charge for; a paywall on re-import turns
    // the export into a hostage note.
    if (method === "POST" && event.rawPath?.endsWith("/import/file")) {
      let payload: unknown;
      try {
        payload = JSON.parse(event.body ?? "");
      } catch {
        throw new BadRequestError("That file isn't valid JSON.");
      }

      const parsed = parseRecipeImport(payload);
      if ("error" in parsed) throw new BadRequestError(parsed.error);

      if (parsed.recipes.length === 0) {
        // Everything was rejected, or the file was empty. Either way the user
        // needs the reasons, not a bare "0 imported".
        return okResponse({
          imported: 0,
          failed: 0,
          results: [],
          rejected: parsed.rejected,
        });
      }

      if (parsed.recipes.length > MAX_IMPORT_RECIPES) {
        throw new BadRequestError(
          `That file holds ${parsed.recipes.length} recipes. ` +
            `Imports are limited to ${MAX_IMPORT_RECIPES} at a time.`,
        );
      }

      const result = await importRecipes(user.id, parsed.recipes);
      return okResponse({ ...result, rejected: parsed.rejected }, 201);
    }

    // POST /recipes/import/ai — AI fallback. Costs one AI credit on success.
    if (method === "POST" && event.rawPath?.endsWith("/import/ai")) {
      assertAiImportAllowed(user);
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
      // Spent only now the model has returned something usable. A credit burned
      // on a paywalled page is the user paying for our problem.
      await incrementAiImportCount(user.id);
      return okResponse(aiResult.recipe);
    }

    // POST /recipes/import/photo — AI extract from photos. One credit on success.
    if (method === "POST" && event.rawPath?.endsWith("/import/photo")) {
      assertAiImportAllowed(user);
      const body = parseBody(
        event.body,
        z.object({
          images: z.array(z.string().min(1)).min(1).max(10),
          mimeTypes: z.array(z.string()).optional().default([]),
        }),
      );
      const result = await importRecipeFromPhotos({
        images: body.images,
        mimeTypes: body.mimeTypes ?? [],
      });
      if (!result.ok) {
        return {
          statusCode: 422,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: { code: "PHOTO_IMPORT_FAILED", message: result.error } }),
        };
      }
      await incrementAiImportCount(user.id);
      return okResponse(result.recipe);
    }

    // POST /recipes/import/text — AI extract from a note. One credit on success.
    if (method === "POST" && event.rawPath?.endsWith("/import/text")) {
      assertAiImportAllowed(user);
      const body = parseBody(event.body, ImportRecipeTextSchema);
      const result = await importRecipeFromText(body.text);
      if (!result.ok) {
        return {
          statusCode: 422,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: { code: "TEXT_IMPORT_FAILED", message: result.error } }),
        };
      }
      await incrementAiImportCount(user.id);
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

      // Clean up S3 image if one exists
      if (deleted.imageUrl && IMAGES_CLOUDFRONT_DOMAIN) {
        const prefix = `https://${IMAGES_CLOUDFRONT_DOMAIN}/`;
        if (deleted.imageUrl.startsWith(prefix)) {
          const s3Key = deleted.imageUrl.slice(prefix.length);
          try {
            await s3Client.send(
              new DeleteObjectCommand({ Bucket: IMAGES_BUCKET_NAME, Key: s3Key }),
            );
          } catch {
            // Non-fatal — log but don't fail the request
            console.error("Failed to delete S3 image", s3Key);
          }
        }
      }

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
