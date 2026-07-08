import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { validateAuth } from "../middleware/auth";
import { handleError, okResponse, NotFoundError } from "../middleware/errors";
import { parseBody } from "../middleware/validation";
import { getUserByCognitoId, updateUser } from "../db/queries/user-queries";

const UpdateUserSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
  dietaryPreferences: z.array(z.string().min(1).max(50)).nullable().optional(),
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

    // GET /users/me
    if (method === "GET" && path.endsWith("/users/me")) {
      return okResponse(user);
    }

    // PATCH /users/me
    if (method === "PATCH" && path.endsWith("/users/me")) {
      const body = parseBody(event.body, UpdateUserSchema);
      const updated = await updateUser(user.id, body);
      if (!updated) throw new NotFoundError("User not found");
      return okResponse(updated);
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
