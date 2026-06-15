import { z } from "zod";

export class ValidationError extends Error {
  public readonly issues: z.ZodIssue[];

  constructor(issues: z.ZodIssue[]) {
    super("Validation failed");
    this.name = "ValidationError";
    this.issues = issues;
  }
}

/**
 * Parse and validate a Lambda event body against a Zod schema.
 * Throws ValidationError if the body is missing or fails validation.
 */
export function parseBody<T>(
  body: string | null | undefined,
  schema: z.ZodSchema<T>,
): T {
  if (!body) {
    throw new ValidationError([
      { code: "custom", message: "Request body is required", path: [] },
    ]);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new ValidationError([
      { code: "custom", message: "Invalid JSON body", path: [] },
    ]);
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new ValidationError(result.error.issues);
  }

  return result.data;
}
