import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { validateAuth } from "../middleware/auth";
import { handleError, okResponse, NotFoundError } from "../middleware/errors";
import { getUserByCognitoId } from "../db/queries/user-queries";
import { getFeed } from "../db/queries/feed-queries";

const FeedQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
});

export const handler: APIGatewayProxyHandlerV2 = async (
  event,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const auth = await validateAuth(event);
    const user = await getUserByCognitoId(auth.cognitoId);
    if (!user) throw new NotFoundError("User not found");

    const query = FeedQuerySchema.parse(event.queryStringParameters ?? {});
    const result = await getFeed(user.id, query);
    return okResponse(result);
  } catch (err) {
    return handleError(err);
  }
};
