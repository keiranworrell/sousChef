import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { validateAuth } from "../middleware/auth";
import { handleError, okResponse, NotFoundError } from "../middleware/errors";
import { parseBody } from "../middleware/validation";
import { getUserByCognitoId, updateUser } from "../db/queries/user-queries";
import {
  followUser,
  unfollowUser,
  getPublicUser,
  getFollowCounts,
  getFollowers,
  getFollowing,
  searchUsers,
} from "../db/queries/follows-queries";

const UserSearchQuerySchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
});

const FollowListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
});

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
    const targetUserId = event.pathParameters?.["id"];

    // GET /users (search)
    if (method === "GET" && path.endsWith("/users")) {
      const query = UserSearchQuerySchema.parse(event.queryStringParameters ?? {});
      const result = await searchUsers(user.id, query);
      return okResponse(result);
    }

    // GET /users/me
    if (method === "GET" && path.endsWith("/users/me")) {
      const counts = await getFollowCounts(user.id);
      return okResponse({ ...user, ...counts });
    }

    // PATCH /users/me
    if (method === "PATCH" && path.endsWith("/users/me")) {
      const body = parseBody(event.body, UpdateUserSchema);
      const updated = await updateUser(user.id, body);
      if (!updated) throw new NotFoundError("User not found");
      return okResponse(updated);
    }

    // GET /users/{id}
    if (method === "GET" && targetUserId && !path.endsWith("/me")) {
      const profile = await getPublicUser(targetUserId, user.id);
      if (!profile) throw new NotFoundError("User not found");
      return okResponse(profile);
    }

    // POST /users/{id}/follow
    if (method === "POST" && targetUserId && path.endsWith("/follow")) {
      if (targetUserId === user.id) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: { code: "CANNOT_FOLLOW_SELF", message: "You cannot follow yourself" } }),
        };
      }
      await followUser(user.id, targetUserId);
      return okResponse(null, 204);
    }

    // DELETE /users/{id}/follow
    if (method === "DELETE" && targetUserId && path.endsWith("/follow")) {
      await unfollowUser(user.id, targetUserId);
      return okResponse(null, 204);
    }

    // GET /users/{id}/followers
    if (method === "GET" && targetUserId && path.endsWith("/followers")) {
      const query = FollowListQuerySchema.parse(event.queryStringParameters ?? {});
      const result = await getFollowers(targetUserId, user.id, query);
      return okResponse(result);
    }

    // GET /users/{id}/following
    if (method === "GET" && targetUserId && path.endsWith("/following")) {
      const query = FollowListQuerySchema.parse(event.queryStringParameters ?? {});
      const result = await getFollowing(targetUserId, user.id, query);
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
