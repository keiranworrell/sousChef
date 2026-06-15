import type { APIGatewayProxyEventV2 } from "aws-lambda";

export type AuthContext = {
  userId: string;
  email: string;
};

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Validates the Cognito JWT from the Authorization header.
 * Returns the decoded user context or throws UnauthorizedError.
 */
export async function validateAuth(
  event: APIGatewayProxyEventV2,
): Promise<AuthContext> {
  const authHeader = event.headers["authorization"];

  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or malformed Authorization header");
  }

  // TODO: verify JWT against Cognito JWKS endpoint
  const _token = authHeader.slice(7);

  throw new UnauthorizedError("JWT validation not yet implemented");
}
