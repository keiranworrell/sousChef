import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
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
  createCookSession,
  getActiveCookSession,
  getCookSession,
  loadPlannableRecipes,
  updateCookSessionProgress,
} from "../db/queries/cook-session-queries";
import { planMultiRecipeCook, sequentialPlan } from "../agents/multi-recipe-cook";

/**
 * Ceiling on recipes per plan. Beyond this the prompt gets long, the model's
 * timing gets vague, and — more to the point — nobody is cooking six recipes at
 * once and wanting a single list of eighty steps.
 */
const MAX_RECIPES_PER_PLAN = 5;

const CreateSessionSchema = z.object({
  recipeIds: z.array(z.string().uuid()).min(2).max(MAX_RECIPES_PER_PLAN),
});

const UpdateProgressSchema = z.object({
  currentStep: z.number().int().nonnegative().optional(),
  completed: z.boolean().optional(),
});

export const handler: APIGatewayProxyHandlerV2 = async (
  event,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const auth = await validateAuth(event);
    const user = await getUserByCognitoId(auth.cognitoId);
    if (!user) throw new NotFoundError("User not found");

    const method = event.requestContext.http.method.toUpperCase();
    const path = event.rawPath ?? "";
    const sessionId = event.pathParameters?.["id"];

    // GET /cook-sessions/active — resume rather than regenerate.
    //
    // Before the generic GET below, which matches any path with an id bound.
    // "active" is a literal segment, not an id, so without this it would be
    // looked up as one and always 404.
    if (method === "GET" && path.endsWith("/cook-sessions/active")) {
      const active = await getActiveCookSession(user.id);
      return okResponse({ sessionId: active?.id ?? null });
    }

    // GET /cook-sessions/{id}
    if (method === "GET" && sessionId) {
      const session = await getCookSession(sessionId, user.id);
      if (!session) throw new NotFoundError("Cook session not found");
      return okResponse(session);
    }

    // PATCH /cook-sessions/{id} — save progress
    if (method === "PATCH" && sessionId) {
      const body = parseBody(event.body, UpdateProgressSchema);
      const updated = await updateCookSessionProgress(sessionId, user.id, body);
      if (!updated) throw new NotFoundError("Cook session not found");
      return okResponse(null, 204);
    }

    // POST /cook-sessions — plan a new cook
    if (method === "POST" && !sessionId) {
      const body = parseBody(event.body, CreateSessionSchema);

      // Duplicates would make the same recipe's steps appear twice and fail
      // validation, which is a confusing way to report a mis-click.
      const unique = [...new Set(body.recipeIds)];
      if (unique.length !== body.recipeIds.length) {
        throw new BadRequestError("Each recipe can only appear once in a plan.");
      }

      const recipes = await loadPlannableRecipes(user.id, unique);
      if (!recipes) throw new NotFoundError("One or more recipes could not be found");

      const withoutSteps = recipes.filter((r) => r.steps.length === 0);
      if (withoutSteps.length > 0) {
        throw new BadRequestError(
          `${withoutSteps.map((r) => r.title).join(", ")} ` +
            `${withoutSteps.length === 1 ? "has" : "have"} no steps to plan around.`,
        );
      }

      // The quota check happens before the model call, so a user with no
      // credits is refused rather than being charged for work they can't have.
      assertAiImportAllowed(user);

      const result = await planMultiRecipeCook(recipes);

      if (result.ok) {
        // Spent only on a plan that passed validation. A rejected plan is our
        // failure, not the user's, and they should not pay a credit for it.
        await incrementAiImportCount(user.id);
        const session = await createCookSession(user.id, unique, result.plan);
        return okResponse({ sessionId: session.id, interleaved: true }, 201);
      }

      // Falling back rather than failing. Someone with the ingredients out
      // wants a usable list of steps far more than they want an error, and the
      // sequential plan is correct even though it is not clever. No credit is
      // charged, and `interleaved: false` lets the client say what happened.
      const session = await createCookSession(user.id, unique, sequentialPlan(recipes));
      return okResponse({ sessionId: session.id, interleaved: false }, 201);
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
