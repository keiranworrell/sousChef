import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { CognitoIdentityProviderClient, AdminDeleteUserCommand } from "@aws-sdk/client-cognito-identity-provider";
import { z } from "zod";
import { validateAuth } from "../middleware/auth";
import { handleError, okResponse, NotFoundError } from "../middleware/errors";
import { parseBody } from "../middleware/validation";

const cognitoClient = new CognitoIdentityProviderClient({});
const COGNITO_USER_POOL_ID = process.env["COGNITO_USER_POOL_ID"] ?? "";
import {
  getUserByCognitoId,
  updateUser,
  deleteUser,
  syncUserEmail,
} from "../db/queries/user-queries";
import { exportUserData } from "../db/queries/export-queries";
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
    let user = await getUserByCognitoId(auth.cognitoId);
    if (!user) throw new NotFoundError("User not found");

    // Reconcile the stored email against the verified token claim.
    //
    // Changing an email happens in Cognito, which is the system of record — the
    // user enters a code sent to the new address, and only then does Cognito
    // accept it. Our users row is a cache of that fact, and it goes stale the
    // moment the change lands. Syncing here, from the claim on an already
    // verified token, means the correct value arrives on the user's next
    // request without any endpoint that accepts an email from the client.
    //
    // The write only happens on an actual difference, so this costs nothing on
    // the overwhelming majority of requests.
    if (user.email !== auth.email) {
      user = (await syncUserEmail(user.id, auth.email)) ?? user;
    }

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

    // GET /users/me/export — UK GDPR right of access / data portability.
    //
    // Order is not load-bearing here: "/users/me/export" does not end with
    // "/users/me", so the check above cannot swallow it. (An earlier comment
    // claimed the opposite. In a file this full of endsWith checks, a comment
    // asserting a constraint that isn't real is worse than none — it invites
    // someone to "preserve" an ordering that was never doing anything, and to
    // trust the same reasoning where it genuinely does matter.)
    //
    // NOTE: if you add a table that references users.id, add it to
    // exportUserData too. An export that silently omits data does not satisfy
    // the access right.
    if (method === "GET" && path.endsWith("/users/me/export")) {
      const data = await exportUserData(user.id);
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          // Prompts a download rather than rendering in the browser
          "Content-Disposition": `attachment; filename="souschef-export-${new Date().toISOString().slice(0, 10)}.json"`,
        },
        body: JSON.stringify({ data }, null, 2),
      };
    }

    // DELETE /users/me
    if (method === "DELETE" && path.endsWith("/users/me")) {
      // Delete Postgres data first (cascades to all child tables)
      await deleteUser(user.id);
      // Delete the Cognito user pool entry to complete GDPR right-to-erasure
      await cognitoClient.send(
        new AdminDeleteUserCommand({
          UserPoolId: COGNITO_USER_POOL_ID,
          Username: auth.cognitoId,
        }),
      );
      return okResponse(null, 204);
    }

    // PATCH /users/me
    if (method === "PATCH" && path.endsWith("/users/me")) {
      const body = parseBody(event.body, UpdateUserSchema);
      const updated = await updateUser(user.id, body);
      if (!updated) throw new NotFoundError("User not found");
      const counts = await getFollowCounts(user.id);
      return okResponse({ ...updated, ...counts });
    }

    // GET /users/{id}/followers  — must come before GET /users/{id}
    if (method === "GET" && targetUserId && path.endsWith("/followers")) {
      const query = FollowListQuerySchema.parse(event.queryStringParameters ?? {});
      const result = await getFollowers(targetUserId, user.id, query);
      return okResponse(result);
    }

    // GET /users/{id}/following  — must come before GET /users/{id}
    if (method === "GET" && targetUserId && path.endsWith("/following")) {
      const query = FollowListQuerySchema.parse(event.queryStringParameters ?? {});
      const result = await getFollowing(targetUserId, user.id, query);
      return okResponse(result);
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
