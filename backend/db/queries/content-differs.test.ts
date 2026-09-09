import { describe, it, expect } from "vitest";
import { contentDiffers } from "./recipe-queries";
import type { RecipeWithDetails } from "./recipe-queries";

/**
 * Governs whether attribution reads "Imported from" or "Adapted from", so a
 * false positive misrepresents an untouched recipe as the user's own work.
 * The edit form posts every field on every save, which is why this compares
 * values rather than checking whether a field was present.
 */

const base = {
  id: "r1",
  userId: "u1",
  title: "Sourdough Focaccia",
  description: "Slow-fermented, olive oil rich",
  imageUrl: null,
  servings: 8,
  prepTimeMinutes: 30,
  cookTimeMinutes: 25,
  difficulty: "medium" as const,
  cuisine: "Italian",
  isPublic: false,
  sourceUrl: "https://example.com/focaccia",
  forkedFromId: null,
  sourceModified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ingredients: [
    { id: "i1", recipeId: "r1", name: "Flour", quantity: 500, unit: "g", notes: null, orderIndex: 0 },
    { id: "i2", recipeId: "r1", name: "Water", quantity: 400, unit: "ml", notes: null, orderIndex: 1 },
  ],
  steps: [
    { id: "s1", recipeId: "r1", stepNumber: 1, instruction: "Mix", timerSeconds: null, imageUrl: null },
    { id: "s2", recipeId: "r1", stepNumber: 2, instruction: "Rest", timerSeconds: 3600, imageUrl: null },
  ],
  tags: [],
} as unknown as RecipeWithDetails;

describe("contentDiffers — reports no change", () => {
  it("for an empty update", () => {
    expect(contentDiffers(base, {})).toBe(false);
  });

  it("when every field is resubmitted unchanged", () => {
    // The edit form always posts the full recipe, so this is the common case.
    // Treating it as a change would mark everything adapted on any save.
    expect(
      contentDiffers(base, {
        title: base.title,
        description: base.description,
        servings: base.servings,
        prepTimeMinutes: base.prepTimeMinutes,
        cookTimeMinutes: base.cookTimeMinutes,
        difficulty: base.difficulty,
        cuisine: base.cuisine,
        ingredients: base.ingredients.map((i) => ({
          name: i.name, quantity: i.quantity, unit: i.unit, notes: i.notes, orderIndex: i.orderIndex,
        })),
        steps: base.steps.map((s) => ({
          stepNumber: s.stepNumber, instruction: s.instruction, timerSeconds: s.timerSeconds,
        })),
      }),
    ).toBe(false);
  });

  it("when only visibility changes", () => {
    // Adding a recipe to a public collection flips isPublic. That is not
    // authorship, and must not read as adaptation.
    expect(contentDiffers(base, { isPublic: true })).toBe(false);
  });

  it("when only tags change", () => {
    // Filing something under "weeknight" isn't adapting it
    expect(contentDiffers(base, { tags: ["weeknight", "bread"] })).toBe(false);
  });
});

describe("contentDiffers — reports a change", () => {
  it("when the title changes", () => {
    expect(contentDiffers(base, { title: "My Focaccia" })).toBe(true);
  });

  it("when the description changes", () => {
    expect(contentDiffers(base, { description: "Reworked hydration" })).toBe(true);
  });

  it("when servings change", () => {
    expect(contentDiffers(base, { servings: 12 })).toBe(true);
  });

  it("when an ingredient quantity changes", () => {
    expect(
      contentDiffers(base, {
        ingredients: [
          { name: "Flour", quantity: 450, unit: "g", notes: null, orderIndex: 0 },
          { name: "Water", quantity: 400, unit: "ml", notes: null, orderIndex: 1 },
        ],
      }),
    ).toBe(true);
  });

  it("when an ingredient is removed", () => {
    expect(
      contentDiffers(base, {
        ingredients: [
          { name: "Flour", quantity: 500, unit: "g", notes: null, orderIndex: 0 },
        ],
      }),
    ).toBe(true);
  });

  it("when a step's wording changes", () => {
    expect(
      contentDiffers(base, {
        steps: [
          { stepNumber: 1, instruction: "Mix thoroughly by hand", timerSeconds: null },
          { stepNumber: 2, instruction: "Rest", timerSeconds: 3600 },
        ],
      }),
    ).toBe(true);
  });

  it("when a step timer changes", () => {
    expect(
      contentDiffers(base, {
        steps: [
          { stepNumber: 1, instruction: "Mix", timerSeconds: null },
          { stepNumber: 2, instruction: "Rest", timerSeconds: 7200 },
        ],
      }),
    ).toBe(true);
  });

  it("when a step is added", () => {
    expect(
      contentDiffers(base, {
        steps: [
          { stepNumber: 1, instruction: "Mix", timerSeconds: null },
          { stepNumber: 2, instruction: "Rest", timerSeconds: 3600 },
          { stepNumber: 3, instruction: "Bake", timerSeconds: 1500 },
        ],
      }),
    ).toBe(true);
  });
});
