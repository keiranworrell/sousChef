import { describe, expect, it } from "vitest";
import { RECIPE_COLOURS, formatOffset, recipeColour } from "./cook-session";

describe("formatOffset", () => {
  it("calls the start of the cook now", () => {
    expect(formatOffset(0)).toBe("Start now");
  });

  it("handles a negative offset from a malformed plan", () => {
    expect(formatOffset(-5)).toBe("Start now");
  });

  it("counts minutes under the hour", () => {
    expect(formatOffset(1)).toBe("~1 min in");
    expect(formatOffset(59)).toBe("~59 min in");
  });

  it("switches to hours on the hour", () => {
    expect(formatOffset(60)).toBe("~1 hr in");
    expect(formatOffset(120)).toBe("~2 hr in");
  });

  it("gives hours and minutes together", () => {
    expect(formatOffset(75)).toBe("~1 hr 15 min in");
    expect(formatOffset(185)).toBe("~3 hr 5 min in");
  });

  it("stays approximate, because the offsets are", () => {
    // No wording here should read as a clock time the plan could be held to.
    expect(formatOffset(45)).toContain("~");
  });
});

describe("recipeColour", () => {
  const ids = ["a", "b", "c"];

  it("gives each recipe its own colour", () => {
    const used = ids.map((id) => recipeColour(ids, id));
    expect(new Set(used).size).toBe(3);
  });

  it("is stable for the same recipe", () => {
    expect(recipeColour(ids, "b")).toBe(recipeColour(ids, "b"));
  });

  it("depends on position in the session, not on step order", () => {
    expect(recipeColour(ids, "a")).toBe(RECIPE_COLOURS[0]);
    expect(recipeColour(ids, "c")).toBe(RECIPE_COLOURS[2]);
  });

  it("wraps once past the end of the palette", () => {
    const many = ["a", "b", "c", "d", "e", "f"];
    expect(recipeColour(many, "f")).toBe(RECIPE_COLOURS[0]);
  });

  it("falls back rather than returning undefined for an unknown recipe", () => {
    // Reachable when a plan outlives an edit to the recipes it was built from.
    expect(recipeColour(ids, "missing")).toBe(RECIPE_COLOURS[0]);
  });
});
