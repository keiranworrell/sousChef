import { describe, it, expect } from "vitest";
import { predictTags } from "./predictive-tags";

// ── Helpers ───────────────────────────────────────────────────────────────────

function tags(ingredients: string[]): string[] {
  return predictTags(ingredients).sort();
}

// ── Minimum ingredient threshold ──────────────────────────────────────────────

describe("predictTags — minimum ingredient threshold", () => {
  it("returns no suggestions for an empty list", () => {
    expect(predictTags([])).toEqual([]);
  });

  it("returns no suggestions when only one ingredient is filled", () => {
    expect(predictTags(["garlic"])).toEqual([]);
  });

  it("returns suggestions once two or more ingredients are filled", () => {
    expect(predictTags(["garlic", "olive oil"]).length).toBeGreaterThan(0);
  });
});

// ── Vegetarian ────────────────────────────────────────────────────────────────

describe("predictTags — vegetarian", () => {
  it("suggests vegetarian for a plant-based ingredient list", () => {
    expect(tags(["garlic", "olive oil", "pasta", "tomato"])).toContain("vegetarian");
  });

  it("does not suggest vegetarian when chicken is present", () => {
    expect(tags(["chicken breast", "garlic", "lemon"])).not.toContain("vegetarian");
  });

  it("does not suggest vegetarian when bacon is present", () => {
    expect(tags(["bacon", "eggs", "butter"])).not.toContain("vegetarian");
  });

  it("does not suggest vegetarian when salmon is present", () => {
    expect(tags(["salmon", "dill", "cream cheese"])).not.toContain("vegetarian");
  });

  it("does not suggest vegetarian when fish sauce is present", () => {
    expect(tags(["fish sauce", "lime juice", "garlic", "chilli"])).not.toContain("vegetarian");
  });

  it("does not suggest vegetarian when worcestershire sauce is present", () => {
    expect(tags(["worcestershire sauce", "soy sauce", "garlic", "ginger"])).not.toContain("vegetarian");
  });
});

// ── Vegan ─────────────────────────────────────────────────────────────────────

describe("predictTags — vegan", () => {
  it("suggests vegan for a fully plant-based list", () => {
    expect(tags(["chickpeas", "olive oil", "lemon juice", "garlic"])).toContain("vegan");
  });

  it("suggests both vegan and vegetarian for a plant-based list", () => {
    const result = tags(["chickpeas", "olive oil", "lemon juice", "garlic"]);
    expect(result).toContain("vegan");
    expect(result).toContain("vegetarian");
  });

  it("does not suggest vegan when eggs are present", () => {
    expect(tags(["eggs", "olive oil", "garlic", "spinach"])).not.toContain("vegan");
  });

  it("does not suggest vegan when butter is present", () => {
    expect(tags(["butter", "sugar", "flour", "vanilla"])).not.toContain("vegan");
  });

  it("does not suggest vegan when cheese is present", () => {
    expect(tags(["pasta", "parmesan", "garlic", "olive oil"])).not.toContain("vegan");
  });

  it("does not suggest vegan when milk is present", () => {
    expect(tags(["oats", "milk", "banana", "honey"])).not.toContain("vegan");
  });

  it("suggests vegetarian but not vegan when only dairy is present", () => {
    const result = tags(["pasta", "cream", "garlic", "parmesan"]);
    expect(result).toContain("vegetarian");
    expect(result).not.toContain("vegan");
  });
});

// ── Dairy-free ────────────────────────────────────────────────────────────────

describe("predictTags — dairy-free", () => {
  it("suggests dairy-free for a meat recipe with no dairy", () => {
    expect(tags(["chicken breast", "olive oil", "garlic", "lemon"])).toContain("dairy-free");
  });

  it("does not suggest dairy-free when butter is present", () => {
    expect(tags(["pasta", "butter", "garlic", "parsley"])).not.toContain("dairy-free");
  });

  it("does not suggest dairy-free when cream is present", () => {
    expect(tags(["mushrooms", "cream", "garlic", "thyme"])).not.toContain("dairy-free");
  });

  it("does not suggest dairy-free when cheese is present", () => {
    expect(tags(["spinach", "feta", "olive oil", "lemon"])).not.toContain("dairy-free");
  });

  it("suggests dairy-free when dairy-free cream cheese is present", () => {
    expect(tags(["dairy-free cream cheese", "cashews", "lemon juice", "garlic"])).toContain("dairy-free");
  });

  it("treats coconut milk as dairy-free", () => {
    expect(tags(["lentils", "coconut milk", "garlic", "cumin"])).toContain("dairy-free");
  });

  it("treats oat milk as dairy-free", () => {
    expect(tags(["oats", "oat milk", "banana", "vanilla extract"])).toContain("dairy-free");
  });

  it("treats almond milk as dairy-free", () => {
    expect(tags(["almond milk", "banana", "spinach", "chia seeds"])).toContain("dairy-free");
  });

  it("treats coconut cream as dairy-free", () => {
    expect(tags(["chicken", "coconut cream", "lime juice", "garlic"])).toContain("dairy-free");
  });

  it("suggests dairy-free for a vegan recipe", () => {
    const result = tags(["lentils", "olive oil", "cumin", "garlic"]);
    expect(result).toContain("dairy-free");
  });
});

// ── Gluten-free ───────────────────────────────────────────────────────────────

describe("predictTags — gluten-free", () => {
  it("suggests gluten-free for a recipe with no gluten ingredients", () => {
    expect(tags(["chicken", "rice", "garlic", "olive oil"])).toContain("gluten-free");
  });

  it("does not suggest gluten-free when plain flour is present", () => {
    expect(tags(["plain flour", "butter", "sugar", "eggs"])).not.toContain("gluten-free");
  });

  it("does not suggest gluten-free when pasta is present", () => {
    expect(tags(["pasta", "tomato", "garlic", "basil"])).not.toContain("gluten-free");
  });

  it("does not suggest gluten-free when breadcrumbs are present", () => {
    expect(tags(["chicken", "breadcrumbs", "egg", "lemon"])).not.toContain("gluten-free");
  });

  it("does not suggest gluten-free when couscous is present", () => {
    expect(tags(["couscous", "vegetables", "olive oil", "lemon"])).not.toContain("gluten-free");
  });

  it("does not suggest gluten-free when soy sauce is present", () => {
    expect(tags(["tofu", "soy sauce", "ginger", "garlic"])).not.toContain("gluten-free");
  });

  it("suggests gluten-free when almond flour is used", () => {
    expect(tags(["almond flour", "eggs", "sugar", "butter"])).toContain("gluten-free");
  });

  it("suggests gluten-free when rice flour is used", () => {
    expect(tags(["rice flour", "coconut milk", "sugar", "eggs"])).toContain("gluten-free");
  });

  it("suggests gluten-free when rice noodles are used", () => {
    expect(tags(["rice noodles", "fish sauce", "lime juice", "garlic"])).toContain("gluten-free");
  });

  it("suggests gluten-free when tamari is used instead of soy sauce", () => {
    expect(tags(["tamari soy sauce", "ginger", "garlic", "sesame oil"])).toContain("gluten-free");
  });

  it("does not suggest gluten-free when barley is present", () => {
    expect(tags(["barley", "mushrooms", "onion", "thyme"])).not.toContain("gluten-free");
  });
});

// ── Real-world recipe scenarios ───────────────────────────────────────────────

describe("predictTags — real-world scenarios", () => {
  it("tags a beef bolognese correctly", () => {
    // No dairy in the ingredient list → dairy-free is correctly suggested
    const result = tags(["minced beef", "tomato", "onion", "garlic", "pasta", "red wine"]);
    expect(result).not.toContain("vegetarian");
    expect(result).not.toContain("vegan");
    expect(result).not.toContain("gluten-free");
    expect(result).toContain("dairy-free");
  });

  it("tags a vegan lentil dal correctly", () => {
    const result = tags(["lentils", "coconut milk", "cumin", "garlic", "ginger", "spinach"]);
    expect(result).toContain("vegetarian");
    expect(result).toContain("vegan");
    expect(result).toContain("dairy-free");
    expect(result).toContain("gluten-free");
  });

  it("tags a cheese omelette correctly", () => {
    const result = tags(["eggs", "cheddar", "butter", "chives"]);
    expect(result).toContain("vegetarian");
    expect(result).toContain("gluten-free");
    expect(result).not.toContain("vegan");
    expect(result).not.toContain("dairy-free");
  });

  it("tags a grilled salmon correctly", () => {
    const result = tags(["salmon", "lemon", "olive oil", "dill"]);
    expect(result).not.toContain("vegetarian");
    expect(result).toContain("dairy-free");
    expect(result).toContain("gluten-free");
  });

  it("tags a Thai green curry correctly", () => {
    const result = tags(["chicken breast", "coconut milk", "green curry paste", "fish sauce", "lime juice", "thai basil"]);
    expect(result).not.toContain("vegetarian");
    expect(result).not.toContain("vegan");
    expect(result).toContain("dairy-free");
    expect(result).toContain("gluten-free");
  });

  it("tags a classic Victoria sponge correctly", () => {
    const result = tags(["plain flour", "butter", "sugar", "eggs", "milk", "vanilla extract"]);
    expect(result).toContain("vegetarian");
    expect(result).not.toContain("vegan");
    expect(result).not.toContain("dairy-free");
    expect(result).not.toContain("gluten-free");
  });

  it("tags a GF almond cake correctly", () => {
    const result = tags(["almond flour", "eggs", "honey", "coconut oil", "vanilla extract"]);
    expect(result).toContain("vegetarian");
    expect(result).toContain("dairy-free");
    expect(result).toContain("gluten-free");
    expect(result).not.toContain("vegan");
  });
});
