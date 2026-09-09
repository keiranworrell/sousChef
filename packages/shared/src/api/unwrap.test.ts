import { describe, it, expect } from "vitest";
import { unwrap } from "./index";
import type { ApiResponse } from "../types";

describe("unwrap", () => {
  it("returns the payload on success", () => {
    const res = { data: { id: "abc", title: "Focaccia" } } as ApiResponse<{
      id: string;
      title: string;
    }>;
    expect(unwrap(res)).toEqual({ id: "abc", title: "Focaccia" });
  });

  it("returns null payloads as-is rather than treating them as absent", () => {
    // 204 responses resolve to { data: null }. That's a success, and unwrap
    // must not confuse it with an error.
    const res = { data: null } as ApiResponse<null>;
    expect(unwrap(res)).toBeNull();
  });

  it("throws on an error envelope", () => {
    const res = {
      error: { code: "NOT_FOUND", message: "That item could not be found." },
    } as ApiResponse<never>;
    expect(() => unwrap(res)).toThrow("That item could not be found.");
  });

  it("carries the error code onto the thrown error", () => {
    // So callers can branch on the cause without string-matching the message
    const res = {
      error: { code: "RATE_LIMITED", message: "Too many requests." },
    } as ApiResponse<never>;
    try {
      unwrap(res);
      throw new Error("should have thrown");
    } catch (err) {
      expect((err as Error & { code?: string }).code).toBe("RATE_LIMITED");
    }
  });

  it("throws an Error instance, so `err instanceof Error` narrowing works", () => {
    // Call sites do `err instanceof Error ? err.message : "..."` — throwing a
    // plain object would make every one of those fall through to the fallback.
    const res = {
      error: { code: "SERVER_ERROR", message: "Something went wrong." },
    } as ApiResponse<never>;
    expect(() => unwrap(res)).toThrow(Error);
  });
});
