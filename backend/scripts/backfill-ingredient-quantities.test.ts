import { describe, expect, it } from "vitest";
import { parseIngredient } from "@souschef/shared";
import { vet } from "./backfill-ingredient-quantities";

/**
 * These tests are the safety case for the backfill.
 *
 * The script edits rows in the live database, and the thing that stops it
 * editing them wrongly is `vet`. `parseIngredient` is tested separately for
 * whether it splits a line correctly; what is tested here is the second
 * question — given a split, is it plausible enough to write.
 */

function row(name: string, unit: string | null = null): { name: string; unit: string | null } {
  return { name, unit };
}

function verdict(line: string, unit: string | null = null): string | null {
  return vet(row(line, unit), parseIngredient(line));
}

describe("backfill vetting", () => {
  it("allows the ordinary imported shapes", () => {
    for (const line of [
      "300 g bread flour",
      "300g bread flour",
      "2 eggs",
      "1 1/2 cups plain flour",
      "½ tsp fine sea salt",
      "250 ml whole milk",
      "Bread flour, 300 g",
      "1 tbsp of olive oil",
      "2.5 kg beef shin",
    ]) {
      expect(verdict(line), line).toBeNull();
    }
  });

  it("leaves genuinely unquantified lines alone without calling them rejections", () => {
    for (const line of [
      "a good glug of olive oil",
      "salt, to taste",
      "freshly ground black pepper",
      "a pinch of saffron",
    ]) {
      const parsed = parseIngredient(line);
      expect(parsed.quantity, line).toBeNull();
      // Null verdict plus null quantity means "nothing to do", not "rejected".
      expect(verdict(line), line).toBeNull();
    }
  });

  it("rejects a bare number too large to be a count", () => {
    // The case that made the ceiling unit-dependent: a vintage year parses
    // perfectly well as a quantity.
    expect(verdict("2024 vintage port")).toMatch(/implausible as a count/);
    expect(verdict("500 eggs")).not.toBeNull();
  });

  it("allows the same magnitude when a unit makes it a measure", () => {
    expect(verdict("2000 g strong flour")).toBeNull();
    expect(verdict("10 kg cabbage")).toBeNull();
    expect(verdict("24 eggs")).toBeNull();
  });

  it("refuses to overrule a unit already on the row", () => {
    expect(verdict("300 g flour", "cup")).toMatch(/conflicts/);
    expect(verdict("300 g flour", "g")).toBeNull();
  });

  it("refuses a parse that is not a reduction of the original name", () => {
    // Guards against a future parser change that starts rewriting rather than
    // splitting. The backfill must not be where that is discovered.
    expect(vet(row("300 g flour"), { name: "wheat", quantity: 300, unit: "g" })).toMatch(
      /not contained in the original/,
    );
  });

  it("refuses degenerate results", () => {
    expect(vet(row("2 g"), { name: "g", quantity: 2, unit: null })).not.toBeNull();
    expect(vet(row("0 g flour"), { name: "flour", quantity: 0, unit: "g" })).not.toBeNull();
    expect(
      vet(row("300 g flour"), { name: "300 g flour", quantity: 300, unit: null }),
    ).toMatch(/nothing was split off/);
  });

  it("keeps the noun on countable-but-unitless ingredients", () => {
    // "2 garlic" on a shopping list is worse than "2 cloves garlic", which is
    // why UNITS omits "clove". Confirmed here because the backfill is what
    // would write that mistake to every existing recipe at once.
    const parsed = parseIngredient("2 cloves garlic, crushed");
    expect(parsed.name).toBe("cloves garlic, crushed");
    expect(parsed.unit).toBeNull();
    expect(vet(row("2 cloves garlic, crushed"), parsed)).toBeNull();
  });
});
