import { describe, it, expect } from "vitest";
import { formatQuantity, scaleQuantity } from "./scale-recipe";

// ─── formatQuantity ────────────────────────────────────────────────────────────

describe("formatQuantity", () => {
  it("formats whole numbers", () => {
    expect(formatQuantity(1)).toBe("1");
    expect(formatQuantity(2)).toBe("2");
    expect(formatQuantity(10)).toBe("10");
  });

  it("formats common vulgar fractions", () => {
    expect(formatQuantity(0.25)).toBe("¼");
    expect(formatQuantity(0.5)).toBe("½");
    expect(formatQuantity(0.75)).toBe("¾");
    expect(formatQuantity(1 / 3)).toBe("⅓");
    expect(formatQuantity(2 / 3)).toBe("⅔");
    expect(formatQuantity(0.125)).toBe("⅛");
  });

  it("formats mixed numbers", () => {
    expect(formatQuantity(1.5)).toBe("1 ½");
    expect(formatQuantity(2.25)).toBe("2 ¼");
    expect(formatQuantity(3.75)).toBe("3 ¾");
  });

  it("falls back to one decimal place for non-fraction values", () => {
    expect(formatQuantity(1.1)).toBe("1.1");
    expect(formatQuantity(2.6)).toBe("2.6");
  });

  it("returns 0 for zero or negative", () => {
    expect(formatQuantity(0)).toBe("0");
  });

  it("rounds values very close to a whole number", () => {
    expect(formatQuantity(1.97)).toBe("2");
    expect(formatQuantity(2.02)).toBe("2");
  });
});

// ─── scaleQuantity ────────────────────────────────────────────────────────────

describe("scaleQuantity", () => {
  it("returns null when quantity is null", () => {
    expect(scaleQuantity(null, "salt", 2)).toBeNull();
  });

  it("returns original formatted value at scale factor 1", () => {
    expect(scaleQuantity(2, "butter", 1)).toBe("2");
    expect(scaleQuantity(0.5, "flour", 1)).toBe("½");
  });

  it("scales standard ingredients linearly", () => {
    expect(scaleQuantity(1, "butter", 2)).toBe("2");
    expect(scaleQuantity(2, "sugar", 3)).toBe("6");
    expect(scaleQuantity(0.5, "cream", 4)).toBe("2");
  });

  it("formats scaled fractions nicely", () => {
    // 200g × 0.5 = 100g (half scale)
    expect(scaleQuantity(1, "flour", 0.5)).toBe("½");
    expect(scaleQuantity(2, "butter", 0.5)).toBe("1");
  });

  // ── Eggs ──────────────────────────────────────────────────────────────────

  it("rounds eggs to nearest half", () => {
    expect(scaleQuantity(2, "eggs", 1.5)).toBe("3");   // 3 exactly
    expect(scaleQuantity(3, "eggs", 2)).toBe("6");
    expect(scaleQuantity(2, "eggs", 1.25)).toBe("2 ½"); // 2.5 → "2 ½"
    expect(scaleQuantity(1, "eggs", 3)).toBe("3");
  });

  it("matches egg variants", () => {
    expect(scaleQuantity(2, "large eggs", 2)).toBe("4");
    expect(scaleQuantity(2, "egg whites", 2)).toBe("4");
    expect(scaleQuantity(1, "egg yolk", 2)).toBe("2");
  });

  it("does not apply egg rule to eggplant", () => {
    expect(scaleQuantity(1, "eggplant", 2)).toBe("2");
    expect(scaleQuantity(1, "aubergine", 2)).toBe("2");
  });

  it("ensures minimum of ½ egg when scaling down", () => {
    expect(scaleQuantity(1, "egg", 0.25)).toBe("½");
  });

  // ── Leavening agents ──────────────────────────────────────────────────────

  it("scales leavening linearly up to 2×", () => {
    expect(scaleQuantity(1, "baking powder", 2)).toBe("2");
    expect(scaleQuantity(2, "baking soda", 2)).toBe("4");
  });

  it("applies diminishing returns on leavening beyond 2×", () => {
    // 1 tsp baking powder × 3 → 2 + (1 × 0.75) = 2.75
    const result = scaleQuantity(1, "baking powder", 3);
    expect(result).toBe("2 ¾");
  });

  it("matches leavening variants", () => {
    const at2x = (name: string): string | null => scaleQuantity(1, name, 2);
    expect(at2x("baking powder")).toBe("2");
    expect(at2x("baking soda")).toBe("2");
    expect(at2x("bicarbonate of soda")).toBe("2");
    expect(at2x("bicarb")).toBe("2");
    expect(at2x("active dry yeast")).toBe("2");
    expect(at2x("instant yeast")).toBe("2");
    expect(at2x("cream of tartar")).toBe("2");
  });
});
