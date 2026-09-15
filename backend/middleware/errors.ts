import type { APIGatewayProxyResultV2 } from "aws-lambda";
import { UnauthorizedError } from "./auth";
import { FREE_TIER_AI_IMPORTS } from "@souschef/shared";
import { ValidationError } from "./validation";

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  constructor(message = "Conflict") {
    super(message);
    this.name = "ConflictError";
  }
}

export class BadRequestError extends Error {
  constructor(message = "Bad request") {
    super(message);
    this.name = "BadRequestError";
  }
}

export class PremiumRequiredError extends Error {
  constructor(message = "This feature requires a premium subscription") {
    super(message);
    this.name = "PremiumRequiredError";
  }
}

/**
 * Throws PremiumRequiredError if the user's planTier is not 'premium'.
 * Call this at the top of any premium-gated route handler.
 *
 * Currently unused: the AI import routes moved to a quota (see
 * assertAiImportAllowed below), which is a strictly friendlier gate. Kept
 * because the pricing plan still puts the fermentation tracker and household
 * sharing behind premium, and those are flat gates when they arrive.
 */
export function assertPremium(planTier: string): void {
  if (planTier !== "premium") {
    throw new PremiumRequiredError();
  }
}

export class AiQuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiQuotaExceededError";
  }
}

/**
 * Gate for the AI import routes.
 *
 * Premium is never counted against. Free accounts get FREE_TIER_AI_IMPORTS
 * lifetime, which exists so someone can watch the feature work before deciding
 * whether it is worth paying for.
 *
 * Deliberately a separate error from PremiumRequiredError. "You need premium"
 * and "you have used your 5 free imports" call for different words on screen
 * and a different decision from the reader, and a single 402 code would force
 * the client to guess which one it was.
 */
export function assertAiImportAllowed(user: {
  planTier: string;
  aiImportCount: number;
}): void {
  if (user.planTier === "premium") return;
  if (user.aiImportCount < FREE_TIER_AI_IMPORTS) return;

  throw new AiQuotaExceededError(
    `You've used all ${FREE_TIER_AI_IMPORTS} of your free AI imports. ` +
      `Upgrade for unlimited AI imports, or add this recipe by hand.`,
  );
}

type ErrorResponse = {
  statusCode: number;
  body: string;
  headers: Record<string, string>;
};

const JSON_HEADERS = { "Content-Type": "application/json" };

function errorBody(code: string, message: string, details?: unknown): string {
  return JSON.stringify({ error: { code, message, ...(details ? { details } : {}) } });
}

export function handleError(err: unknown): APIGatewayProxyResultV2 {
  if (err instanceof UnauthorizedError) {
    return {
      statusCode: 401,
      headers: JSON_HEADERS,
      body: errorBody("UNAUTHORIZED", err.message),
    };
  }

  if (err instanceof NotFoundError) {
    return {
      statusCode: 404,
      headers: JSON_HEADERS,
      body: errorBody("NOT_FOUND", err.message),
    };
  }

  if (err instanceof ConflictError) {
    return {
      statusCode: 409,
      headers: JSON_HEADERS,
      body: errorBody("CONFLICT", err.message),
    };
  }

  if (err instanceof BadRequestError) {
    return {
      statusCode: 400,
      headers: JSON_HEADERS,
      body: errorBody("BAD_REQUEST", err.message),
    };
  }

  if (err instanceof PremiumRequiredError) {
    return {
      statusCode: 402,
      headers: JSON_HEADERS,
      body: errorBody("PREMIUM_REQUIRED", err.message),
    };
  }

  if (err instanceof AiQuotaExceededError) {
    return {
      statusCode: 402,
      headers: JSON_HEADERS,
      body: errorBody("AI_QUOTA_EXCEEDED", err.message),
    };
  }

  if (err instanceof ValidationError) {
    return {
      statusCode: 422,
      headers: JSON_HEADERS,
      body: errorBody("VALIDATION_ERROR", "Validation failed", err.issues),
    };
  }

  if (err instanceof Error) {
    console.error("Unhandled error:", err);
    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: errorBody("INTERNAL_SERVER_ERROR", "An unexpected error occurred"),
    };
  }

  return {
    statusCode: 500,
    headers: JSON_HEADERS,
    body: errorBody("INTERNAL_SERVER_ERROR", "An unexpected error occurred"),
  };
}

export function okResponse<T>(data: T, statusCode = 200): ErrorResponse {
  return {
    statusCode,
    headers: JSON_HEADERS,
    body: JSON.stringify({ data }),
  };
}
