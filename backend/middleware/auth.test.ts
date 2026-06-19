import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateAuth, UnauthorizedError } from "./auth";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

// Mock aws-jwt-verify so tests don't make real network calls
vi.mock("aws-jwt-verify", () => ({
  CognitoJwtVerifier: {
    create: vi.fn(() => ({
      verify: vi.fn(),
    })),
  },
}));

function makeEvent(
  authHeader?: string,
): Partial<APIGatewayProxyEventV2> {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
  };
}

describe("validateAuth", () => {
  beforeEach(() => {
    vi.resetModules();
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
    const { CognitoJwtVerifier } = await import("aws-jwt-verify");
    const mockVerify = vi.fn().mockRejectedValue(new Error("Token expired"));
    vi.mocked(CognitoJwtVerifier.create).mockReturnValue({
      verify: mockVerify,
    } as unknown as ReturnType<typeof CognitoJwtVerifier.create>);

    const event = makeEvent("Bearer invalidtoken");
    await expect(
      validateAuth(event as APIGatewayProxyEventV2),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("returns AuthContext when JWT is valid", async () => {
    const { CognitoJwtVerifier } = await import("aws-jwt-verify");
    const mockVerify = vi.fn().mockResolvedValue({
      sub: "user-cognito-id-123",
      email: "test@example.com",
    });
    vi.mocked(CognitoJwtVerifier.create).mockReturnValue({
      verify: mockVerify,
    } as unknown as ReturnType<typeof CognitoJwtVerifier.create>);

    const event = makeEvent("Bearer validtoken");
    const result = await validateAuth(event as APIGatewayProxyEventV2);

    expect(result).toEqual({
      cognitoId: "user-cognito-id-123",
      email: "test@example.com",
    });
  });
});
