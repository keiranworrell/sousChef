import type { APIGatewayProxyResultV2 } from "aws-lambda";
import { UnauthorizedError } from "./auth";
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
