import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { z } from "zod";
import { validateAuth } from "../middleware/auth";
import { handleError, okResponse, NotFoundError } from "../middleware/errors";
import { parseBody } from "../middleware/validation";
import { getUserByCognitoId } from "../db/queries/user-queries";

const PresignRequestSchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
  context: z.enum(["recipe", "avatar"]).default("recipe"),
});

const EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const BUCKET_NAME = process.env["IMAGES_BUCKET_NAME"] ?? "";
const CLOUDFRONT_DOMAIN = process.env["IMAGES_CLOUDFRONT_DOMAIN"] ?? "";
const AWS_REGION = process.env["AWS_REGION"] ?? "eu-west-2";

export const handler: APIGatewayProxyHandlerV2 = async (
  event,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const auth = await validateAuth(event);
    const user = await getUserByCognitoId(auth.cognitoId);
    if (!user) throw new NotFoundError("User not found");

    const method = event.requestContext.http.method.toUpperCase();
    const path = event.rawPath ?? "";

    // POST /images/presign
    if (method === "POST" && path.endsWith("/images/presign")) {
      const body = parseBody(event.body, PresignRequestSchema);
      const ext = EXTENSION_MAP[body.contentType] ?? "jpg";
      const folder = body.context === "avatar" ? "avatars" : "recipes";
      const key = `${folder}/${user.id}/${randomUUID()}.${ext}`;

      const client = new S3Client({ region: AWS_REGION });
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ContentType: body.contentType,
      });

      const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });
      const imageUrl = `https://${CLOUDFRONT_DOMAIN}/${key}`;

      return okResponse({ uploadUrl, imageUrl });
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
