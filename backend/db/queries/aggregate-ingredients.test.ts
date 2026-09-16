import { describe, expect, it } from "vitest";
import { aggregateIngredients } from "./mealplan-queries";

/**
 * The shopping list's whole job is one line per thing you buy. This has now
 * been wrong twice — first because repeated recipes were counted once, then
 * because a unit mismatch split a single ingredient in two — so the rule is
 * pinned here rather than left to inspection.
 */
describe("one line per ingredient, whatever the wording", () => {
  it("merges a measured entry with an unmeasured one", () => {
    // The reported bug: "salt" with 6 g and "salt, a sprinkle" with nothing
    // produced two salt lines.
    const result = aggregateIngredients([
      { name: "salt", quantity: 6, unit: "g" },
      { name: "salt, a sprinkle", quantity: null, unit: null },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.quantity).toBe(6);
    expect(result[0]?.unit).toBe("g");
    expect(result[0]?.name).toContain("salt");
  });

  it("uses the shorter name as the label", () => {
    const result = aggregateIngredients([
      { name: "salt, a generous pinch", quantity: null, unit: null },
      { name: "salt", quantity: 6, unit: "g" },
    ]);
    expect(result[0]?.name.startsWith("salt")).toBe(true);
    expect(result[0]?.name).not.toContain("generous");
  });

  it("sums quantities that share a unit", () => {
    const result = aggregateIngredients([
      { name: "plain flour", quantity: 200, unit: "g" },
      { name: "plain flour, sifted", quantity: 300, unit: "g" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.quantity).toBe(500);
  });

  it("merges names the synonym table treats as the same thing", () => {
    const result = aggregateIngredients([
      { name: "mince", quantity: 500, unit: "g" },
      { name: "93/7 ground beef", quantity: 250, unit: "g" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.quantity).toBe(750);
  });

  it("keeps genuinely different ingredients apart", () => {
    const result = aggregateIngredients([
      { name: "salt", quantity: 6, unit: "g" },
      { name: "caster sugar", quantity: 15, unit: "g" },
    ]);
    expect(result).toHaveLength(2);
  });
});

describe("nothing is silently lost", () => {
  it("mentions a quantity in an incompatible unit rather than dropping it", () => {
    // Dropping the 200 ml because the line is already in grams would be the
    // same class of error as the duplicate this replaced: quietly wrong.
    const result = aggregateIngredients([
      { name: "milk", quantity: 500, unit: "g" },
      { name: "milk", quantity: 200, unit: "ml" },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toContain("200");
    expect(result[0]?.name).toContain("ml");
  });

  it("notes that there is extra when one entry had no quantity", () => {
    const result = aggregateIngredients([
      { name: "olive oil", quantity: 2, unit: "tbsp" },
      { name: "olive oil, for drizzling", quantity: null, unit: null },
    ]);
    expect(result[0]?.name).toContain("+");
  });

  it("does not add a note when there is nothing extra to say", () => {
    const result = aggregateIngredients([
      { name: "salt", quantity: 6, unit: "g" },
    ]);
    expect(result[0]?.name).toBe("salt");
  });

  it("keeps an ingredient with no quantity at all", () => {
    const result = aggregateIngredients([
      { name: "black pepper, to taste", quantity: null, unit: null },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.quantity).toBeNull();
  });
});

describe("arithmetic that survives floats", () => {
  it("does not print float noise in the extras", () => {
    const result = aggregateIngredients([
      { name: "cream", quantity: 100, unit: "g" },
      { name: "cream", quantity: 0.1, unit: "l" },
      { name: "cream", quantity: 0.2, unit: "l" },
    ]);
    // 0.1 + 0.2 is 0.30000000000000004 in binary floating point.
    expect(result[0]?.name).not.toContain("0000");
  });

  it("returns nothing for an empty plan", () => {
    expect(aggregateIngredients([])).toEqual([]);
  });
});
