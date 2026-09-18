import { describe, expect, it } from "vitest";
import type { CreateRecipeInput } from "@souschef/shared";
import { draftToFormFields } from "./recipe-draft";

/**
 * A photo or paste import fills this form in for the user to review. Every
 * mistake here is silent: a field that reads "null", a prep time of 0 that the
 * import never claimed, or a form with no ingredient rows at all. None of them
 * throw, and all of them get saved if the user doesn't notice.
 */

function draft(over: Partial<CreateRecipeInput> = {}): CreateRecipeInput {
  return { title: "Focaccia", ...over };
}

describe("draftToFormFields", () => {
  it("turns absent numbers into empty fields, not 'null' or '0'", () => {
    // An empty box says "nothing was stated", which is true and editable.
    // A zero says "this takes no time to prepare", which the import never said.
    const f = draftToFormFields(draft({ prepTimeMinutes: null, cookTimeMinutes: undefined }));
    expect(f.prepTime).toBe("");
    expect(f.cookTime).toBe("");
  });

  it("keeps numbers that were stated", () => {
    const f = draftToFormFields(draft({ prepTimeMinutes: 20, cookTimeMinutes: 35 }));
    expect(f.prepTime).toBe("20");
    expect(f.cookTime).toBe("35");
  });

  it("falls back to the form's own default servings", () => {
    // The manual form starts at 4. An import that found no serving count should
    // land in the same place rather than on an empty box to be noticed.
    expect(draftToFormFields(draft()).servings).toBe("4");
    expect(draftToFormFields(draft({ servings: 12 })).servings).toBe("12");
  });

  it("always leaves a row to type into", () => {
    // A form with no ingredient fields looks broken rather than empty.
    const f = draftToFormFields(draft({ ingredients: [], steps: [] }));
    expect(f.ingredients).toHaveLength(1);
    expect(f.steps).toHaveLength(1);
    expect(f.ingredients[0]).toEqual({ name: "", quantity: "", unit: "" });
  });

  it("carries ingredients across, stringifying quantities", () => {
    const f = draftToFormFields(
      draft({
        ingredients: [
          { name: "strong flour", quantity: 500, unit: "g", orderIndex: 0 },
          { name: "salt", quantity: null, unit: null, orderIndex: 1 },
        ],
      }),
    );
    expect(f.ingredients).toEqual([
      { name: "strong flour", quantity: "500", unit: "g" },
      { name: "salt", quantity: "", unit: "" },
    ]);
  });

  it("carries steps across in order", () => {
    const f = draftToFormFields(
      draft({
        steps: [
          { stepNumber: 1, instruction: "Mix", timerSeconds: 60 },
          { stepNumber: 2, instruction: "Rest", timerSeconds: null },
        ],
      }),
    );
    expect(f.steps).toEqual([
      { instruction: "Mix", timerSeconds: "60" },
      { instruction: "Rest", timerSeconds: "" },
    ]);
  });

  it("never yields a null or undefined in a text field", () => {
    // TextInput renders the string "null" quite happily.
    const f = draftToFormFields(draft({ description: null, cuisine: null, difficulty: null }));
    expect(f.description).toBe("");
    expect(f.cuisine).toBe("");
    expect(f.difficulty).toBe("");
  });
});
