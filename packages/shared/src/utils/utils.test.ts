import { describe, it, expect } from "vitest";
import { clamp, round, isApiSuccess, isApiError } from "./index";

describe("clamp", () => {
  it("returns the value when within range", () => {
    expect(clamp(5, 1, 10)).toBe(5);
  });

  it("returns min when value is below range", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it("returns max when value is above range", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("returns the value when it equals min", () => {
    expect(clamp(0, 0, 10)).toBe(0);
  });

  it("returns the value when it equals max", () => {
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe("round", () => {
  it("rounds to the given number of decimal places", () => {
    expect(round(1.2345, 2)).toBe(1.23);
  });

  it("rounds up correctly", () => {
    expect(round(1.235, 2)).toBe(1.24);
  });

  it("rounds to zero decimals", () => {
    expect(round(1.6, 0)).toBe(2);
  });

  it("handles exact values without error", () => {
    expect(round(1.5, 1)).toBe(1.5);
  });
});

describe("isApiSuccess", () => {
  it("returns true for a success response", () => {
    expect(isApiSuccess({ data: { id: "1" } })).toBe(true);
  });

  it("returns false for an error response", () => {
    expect(
      isApiSuccess({ error: { code: "NOT_FOUND", message: "Not found" } }),
    ).toBe(false);
  });
});

describe("isApiError", () => {
  it("returns true for an error response", () => {
    expect(
      isApiError({ error: { code: "NOT_FOUND", message: "Not found" } }),
    ).toBe(true);
  });

  it("returns false for a success response", () => {
    expect(isApiError({ data: { id: "1" } })).toBe(false);
  });
});
