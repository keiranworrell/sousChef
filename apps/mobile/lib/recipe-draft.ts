import type { CreateRecipeInput } from "@souschef/shared";

/**
 * Turning a parsed recipe into the new-recipe form's fields.
 *
 * The AI import endpoints return a `CreateRecipeInput` rather than saving
 * anything, which is the right shape: extraction from a photo or a block of
 * text is a guess, and a guess should be reviewed before it becomes a recipe
 * the user believes. So the import tabs fill the manual form in and hand it
 * over, rather than writing straight to the database.
 *
 * Every numeric field becomes a string because that is what a TextInput holds.
 * Doing that conversion inline in the screen is where the off-by-one mistakes
 * live — a null quantity rendering as "null", a zero prep time rendering as
 * "0" when it means "not stated".
 */

export type IngredientField = { name: string; quantity: string; unit: string };
export type StepField = { instruction: string; timerSeconds: string };

export type RecipeFormFields = {
  title: string;
  description: string;
  servings: string;
  prepTime: string;
  cookTime: string;
  difficulty: "" | "easy" | "medium" | "hard";
  cuisine: string;
  ingredients: IngredientField[];
  steps: StepField[];
};

/**
 * Absent values become "" rather than "null" or "0".
 *
 * An empty field says "nothing was stated", which is true and editable. A zero
 * says "this takes no time to prepare", which is a claim the import never made.
 */
function num(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

function text(value: string | null | undefined): string {
  return value ?? "";
}

export function draftToFormFields(draft: CreateRecipeInput): RecipeFormFields {
  const ingredients: IngredientField[] = (draft.ingredients ?? []).map((i) => ({
    name: text(i.name),
    quantity: num(i.quantity),
    unit: text(i.unit),
  }));

  const steps: StepField[] = (draft.steps ?? []).map((s) => ({
    instruction: text(s.instruction),
    timerSeconds: num(s.timerSeconds),
  }));

  return {
    title: text(draft.title),
    description: text(draft.description),
    // The form defaults to 4 when nothing is set; an import that found no
    // serving count should land on the same default rather than an empty box
    // the user has to notice and fill.
    servings: draft.servings ? String(draft.servings) : "4",
    prepTime: num(draft.prepTimeMinutes),
    cookTime: num(draft.cookTimeMinutes),
    difficulty: draft.difficulty ?? "",
    cuisine: text(draft.cuisine),
    // Always leave one empty row to type into. An import that returned nothing
    // would otherwise present a form with no ingredient fields at all, which
    // looks broken rather than empty.
    ingredients: ingredients.length > 0 ? ingredients : [{ name: "", quantity: "", unit: "" }],
    steps: steps.length > 0 ? steps : [{ instruction: "", timerSeconds: "" }],
  };
}
