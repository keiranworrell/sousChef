import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateAuth, UnauthorizedError } from "./auth";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

/**
 * mockVerify is defined at module scope so it is the same function reference
 * that ends up inside the _verifier singleton in auth.ts. Tests configure its
 * behaviour with mockResolvedValue / mockRejectedValue per-test.
 */
const mockVerify = vi.fn();

vi.mock("aws-jwt-verify", () => ({
  CognitoJwtVerifier: {
    create: vi.fn(() => ({ verify: mockVerify })),
  },
}));

function makeEvent(authHeader?: string): Partial<APIGatewayProxyEventV2> {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
  };
}

describe("validateAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env["COGNITO_USER_POOL_ID"] = "eu-west-2_testpool";
    process.env["COGNITO_CLIENT_ID"] = "testclientid";
  });

  it("throws UnauthorizedError when Authorization header is missing", async () => {
    const event = makeEvent();
    await expect(
      validateAuth(event as APIGatewayProxyEventV2),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError when Authorization header is not a Bearer token", async () => {
    const event = makeEvent("Basic somebase64value");
    await expect(
      validateAuth(event as APIGatewayProxyEventV2),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError when JWT verification fails", async () => {
    mockVerify.mockRejectedValue(new Error("Token expired"));
    const event = makeEvent("Bearer invalidtoken");
    await expect(
      validateAuth(event as APIGatewayProxyEventV2),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("returns AuthContext when JWT is valid", async () => {
    mockVerify.mockResolvedValue({
      sub: "user-cognito-id-123",
      email: "test@example.com",
    });
    const event = makeEvent("Bearer validtoken");
    const result = await validateAuth(event as APIGatewayProxyEventV2);
    expect(result).toEqual({
      cognitoId: "user-cognito-id-123",
      email: "test@example.com",
    });
  });
});
