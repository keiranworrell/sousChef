import { describe, expect, it } from "vitest";
import {
  InterchangeRecipeSchema,
  parseRecipeImport,
  type InterchangeRecipe,
} from "./recipe-interchange";

const fullRecipe: InterchangeRecipe = {
  title: "Sourdough focaccia",
  description: "Long cold ferment",
  imageUrl: "https://cdn.example.com/focaccia.jpg",
  servings: 8,
  prepTimeMinutes: 30,
  cookTimeMinutes: 25,
  difficulty: "medium",
  cuisine: "Italian",
  sourceUrl: "https://example.com/focaccia",
  sourceModified: true,
  tags: ["bread", "fermentation"],
  ingredients: [
    { name: "strong white flour", quantity: 500, unit: "g", notes: null },
    { name: "salt", quantity: 10, unit: "g", notes: "fine sea salt" },
  ],
  steps: [
    { instruction: "Mix and rest", timerSeconds: 1800, imageUrl: null },
    { instruction: "Fold every 30 minutes", timerSeconds: null, imageUrl: null },
  ],
  createdAt: "2026-01-02T10:00:00.000Z",
  updatedAt: "2026-02-02T10:00:00.000Z",
};

describe("the interchange format round-trips", () => {
  it("survives a JSON encode and decode unchanged", () => {
    const decoded = JSON.parse(JSON.stringify(fullRecipe)) as unknown;
    const result = InterchangeRecipeSchema.safeParse(decoded);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(fullRecipe);
  });

  it("keeps source attribution across the round trip", () => {
    const parsed = parseRecipeImport({ recipes: [fullRecipe] });

    expect("error" in parsed).toBe(false);
    if ("error" in parsed) return;
    expect(parsed.recipes[0]?.sourceUrl).toBe("https://example.com/focaccia");
    expect(parsed.recipes[0]?.sourceModified).toBe(true);
  });

  it("preserves ingredient and step order by array position", () => {
    const parsed = parseRecipeImport([fullRecipe]);

    expect("error" in parsed).toBe(false);
    if ("error" in parsed) return;
    expect(parsed.recipes[0]?.ingredients?.map((i) => i.name)).toEqual([
      "strong white flour",
      "salt",
    ]);
    expect(parsed.recipes[0]?.steps?.map((s) => s.instruction)).toEqual([
      "Mix and rest",
      "Fold every 30 minutes",
    ]);
  });
});

describe("accepting the shapes a user might actually have", () => {
  it("reads a full account export", () => {
    const parsed = parseRecipeImport({
      format: "souschef-export-v1",
      account: { email: "someone@example.com" },
      recipes: [fullRecipe],
      collections: [],
    });

    expect("error" in parsed).toBe(false);
    if ("error" in parsed) return;
    expect(parsed.recipes).toHaveLength(1);
  });

  it("reads a bare array", () => {
    const parsed = parseRecipeImport([fullRecipe, fullRecipe]);

    expect("error" in parsed).toBe(false);
    if ("error" in parsed) return;
    expect(parsed.recipes).toHaveLength(2);
  });

  it("reads a single recipe object", () => {
    const parsed = parseRecipeImport(fullRecipe);

    expect("error" in parsed).toBe(false);
    if ("error" in parsed) return;
    expect(parsed.recipes).toHaveLength(1);
  });

  it("accepts a minimal recipe with only a title", () => {
    const parsed = parseRecipeImport({ recipes: [{ title: "Beans on toast" }] });

    expect("error" in parsed).toBe(false);
    if ("error" in parsed) return;
    expect(parsed.recipes).toHaveLength(1);
    expect(parsed.rejected).toHaveLength(0);
  });

  it("does not reject a file whose format string is unfamiliar", () => {
    // A future version, or a hand-written file. The recipes are what matter.
    const parsed = parseRecipeImport({
      format: "souschef-export-v9",
      recipes: [fullRecipe],
    });

    expect("error" in parsed).toBe(false);
    if ("error" in parsed) return;
    expect(parsed.recipes).toHaveLength(1);
  });
});

describe("reporting what it could not take", () => {
  it("imports the good recipes and reports the bad ones", () => {
    const parsed = parseRecipeImport({
      recipes: [fullRecipe, { description: "no title here" }, { title: "Fine" }],
    });

    expect("error" in parsed).toBe(false);
    if ("error" in parsed) return;
    expect(parsed.recipes).toHaveLength(2);
    expect(parsed.rejected).toHaveLength(1);
    expect(parsed.rejected[0]?.index).toBe(1);
    expect(parsed.rejected[0]?.title).toBeNull();
  });

  it("names the offending field in the rejection reason", () => {
    const parsed = parseRecipeImport({
      recipes: [{ title: "Bad servings", servings: -4 }],
    });

    expect("error" in parsed).toBe(false);
    if ("error" in parsed) return;
    expect(parsed.rejected[0]?.reason).toContain("servings");
  });

  it("errors on a file with nothing recipe-shaped in it", () => {
    const parsed = parseRecipeImport({ shoppingLists: [] });

    expect("error" in parsed).toBe(true);
  });

  it("errors on a bare string", () => {
    expect("error" in parseRecipeImport("not a recipe")).toBe(true);
  });

  it("returns an empty result rather than erroring on an empty recipe list", () => {
    const parsed = parseRecipeImport({ recipes: [] });

    expect("error" in parsed).toBe(false);
    if ("error" in parsed) return;
    expect(parsed.recipes).toHaveLength(0);
  });
});
