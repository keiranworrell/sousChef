import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { validateAuth } from "../middleware/auth";
import { handleError, okResponse, NotFoundError } from "../middleware/errors";
import { getUserByCognitoId } from "../db/queries/user-queries";
import {
  listNotifications,
  markNotificationSeen,
  markAllNotificationsSeen,
} from "../db/queries/notification-queries";

// ── Handler ────────────────────────────────────────────────────────────────────

export const handler: APIGatewayProxyHandlerV2 = async (
  event,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const auth = await validateAuth(event);
    const user = await getUserByCognitoId(auth.cognitoId);
    if (!user) throw new NotFoundError("User not found");

    const method = event.requestContext.http.method.toUpperCase();
    const path = event.rawPath ?? "";

    // POST /notifications/seen-all — must come before /{id}/seen
    if (method === "POST" && path.endsWith("/notifications/seen-all")) {
      await markAllNotificationsSeen(user.id);
      return okResponse(null, 204);
    }

    // POST /notifications/{id}/seen
    const seenMatch = path.match(/\/notifications\/([^/]+)\/seen$/);
    if (seenMatch && method === "POST") {
      const notificationId = seenMatch[1]!;
      await markNotificationSeen(notificationId, user.id);
      return okResponse(null, 204);
    }

    // GET /notifications
    if (method === "GET" && path.endsWith("/notifications")) {
      const result = await listNotifications(user.id);
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
