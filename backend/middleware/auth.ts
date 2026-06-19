import { CognitoJwtVerifier } from "aws-jwt-verify";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export type AuthContext = {
  /** Cognito sub — matches the cognito_id column in our users table */
  cognitoId: string;
  email: string;
};

/**
 * Singleton verifier — aws-jwt-verify caches the Cognito JWKS after the first
 * fetch so subsequent calls are fast with no extra network overhead.
 *
 * We verify ID tokens (tokenUse: "id") because they carry email and profile
 * claims directly, which our handlers need to identify the calling user.
 */
let _verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

function getVerifier(): ReturnType<typeof CognitoJwtVerifier.create> {
  if (_verifier) return _verifier;

  const userPoolId = process.env["COGNITO_USER_POOL_ID"];
  // Accepts a comma-separated list of client IDs (e.g. web + mobile)
  const clientIds = process.env["COGNITO_CLIENT_IDS"]?.split(",").filter(Boolean);

  if (!userPoolId || !clientIds?.length) {
    throw new Error(
      "COGNITO_USER_POOL_ID and COGNITO_CLIENT_IDS environment variables must be set",
    );
  }

  _verifier = CognitoJwtVerifier.create({
    userPoolId,
    tokenUse: "id",
    clientId: clientIds,
  });

  return _verifier;
}

/**
 * Extracts and verifies the Bearer token from the Authorization header.
 * Throws UnauthorizedError if the token is missing, malformed, or invalid.
 */
export async function validateAuth(
  event: APIGatewayProxyEventV2,
): Promise<AuthContext> {
  const authHeader =
    event.headers["authorization"] ?? event.headers["Authorization"];

  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or malformed Authorization header");
  }

  const token = authHeader.slice(7);

  try {
    const payload = await getVerifier().verify(token);

    const email = payload["email"];
    if (typeof email !== "string") {
      throw new UnauthorizedError("Token payload is missing email claim");
    }

    return {
      cognitoId: payload.sub,
      email,
    };
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError("Invalid or expired token");
  }
}
