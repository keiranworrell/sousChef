import { describe, expect, it } from "vitest";
import { planItemMerge, type MergeableItem } from "./shopping-queries";
import { combineQuantities } from "./unit-math";

function item(over: Partial<MergeableItem> = {}): MergeableItem {
  return {
    id: "i1",
    name: "spring onions",
    quantity: null,
    unit: null,
    category: null,
    isChecked: false,
    orderIndex: 0,
    ...over,
  };
}

describe("combineQuantities", () => {
  it("adds amounts in the same unit", () => {
    const r = combineQuantities([
      { quantity: 200, unit: "g" },
      { quantity: 300, unit: "g" },
    ]);
    expect(r).toEqual({ unit: "g", quantity: 500, extras: [] });
  });

  it("converts before adding", () => {
    // 1 kg + 500 g is 1500 g, not two separate lines.
    const r = combineQuantities([
      { quantity: 1, unit: "kg" },
      { quantity: 500, unit: "g" },
    ]);
    expect(r.unit).toBe("g");
    expect(r.quantity).toBe(1500);
    expect(r.extras).toEqual([]);
  });

  it("mentions amounts it cannot convert rather than dropping them", () => {
    // Grams and millilitres need a density to combine, and guessing at one is
    // worse than saying both numbers.
    const r = combineQuantities([
      { quantity: 500, unit: "g" },
      { quantity: 200, unit: "ml" },
    ]);
    expect(r.unit).toBe("g");
    expect(r.quantity).toBe(500);
    expect(r.extras).toEqual(["200 ml"]);
  });

  it("records an unquantified entry without inventing a number for it", () => {
    const r = combineQuantities([
      { quantity: 6, unit: "g" },
      { quantity: null, unit: null },
    ]);
    expect(r.quantity).toBe(6);
    expect(r.extras).toEqual(["plus a little more"]);
  });

  it("says nothing extra when there is no measured amount to be extra to", () => {
    // A line that is only "a pinch" should not read "(+ plus a little more)".
    const r = combineQuantities([
      { quantity: null, unit: null },
      { quantity: null, unit: null },
    ]);
    expect(r).toEqual({ unit: null, quantity: null, extras: [] });
  });

  it("trims float noise off converted amounts", () => {
    const r = combineQuantities([
      { quantity: 1, unit: "tbsp" },
      { quantity: 1, unit: "tsp" },
    ]);
    expect(r.unit).toBe("ml");
    // 14.7868 + 4.92892 — the point is it doesn't surface as 19.71572000000...
    expect(String(r.quantity)).not.toMatch(/\d{6,}/);
  });
});

describe("planItemMerge", () => {
  it("uses the name the user chose, not either original", () => {
    const plan = planItemMerge(
      [item({ id: "a", name: "scallions" }), item({ id: "b", name: "spring onions" })],
      "Spring onions",
    );
    expect(plan.name).toBe("Spring onions");
  });

  it("appends unconvertible amounts to the chosen name", () => {
    const plan = planItemMerge(
      [
        item({ id: "a", quantity: 500, unit: "g" }),
        item({ id: "b", quantity: 200, unit: "ml" }),
      ],
      "Stock",
    );
    expect(plan.name).toBe("Stock (+ 200 ml)");
    expect(plan.quantity).toBe(500);
    expect(plan.unit).toBe("g");
  });

  it("only counts as bought if every part was", () => {
    // Merging something bought with something still needed leaves something
    // still needed. Marking it done would remove it from the list mid-shop.
    const mixed = planItemMerge(
      [item({ id: "a", isChecked: true }), item({ id: "b", isChecked: false })],
      "Onions",
    );
    expect(mixed.isChecked).toBe(false);

    const both = planItemMerge(
      [item({ id: "a", isChecked: true }), item({ id: "b", isChecked: true })],
      "Onions",
    );
    expect(both.isChecked).toBe(true);
  });

  it("keeps the earliest position so the line doesn't jump to the bottom", () => {
    const plan = planItemMerge(
      [item({ id: "a", orderIndex: 7 }), item({ id: "b", orderIndex: 2 })],
      "Onions",
    );
    expect(plan.orderIndex).toBe(2);
  });

  it("keeps a category rather than letting a null drop the row out of its aisle", () => {
    const plan = planItemMerge(
      [item({ id: "a", category: null }), item({ id: "b", category: "Produce" })],
      "Onions",
    );
    expect(plan.category).toBe("Produce");
  });

  it("trims the chosen name", () => {
    expect(planItemMerge([item({ id: "a" }), item({ id: "b" })], "  Onions  ").name).toBe(
      "Onions",
    );
  });
});
