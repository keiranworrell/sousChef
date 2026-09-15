import type { InterchangeRecipe } from "@souschef/shared";
import { createRecipe } from "./recipe-queries";

export type ImportedRecipeResult =
  | { status: "imported"; title: string; recipeId: string }
  | { status: "failed"; title: string; reason: string };

export type ImportRecipesResult = {
  imported: number;
  failed: number;
  results: ImportedRecipeResult[];
};

/**
 * Create recipes in this account from parsed interchange records.
 *
 * Deliberately not a transaction. A user restoring 200 recipes after a bad day
 * would rather have 198 of them than none because one had a malformed step, and
 * the per-recipe report tells them exactly which two to look at. Rolling the
 * whole thing back would turn a partial success into a total failure, which is
 * the worse outcome for the person doing the restoring.
 *
 * Imports are always private. A recipe's public flag is a decision about this
 * account's community presence, not a property of the recipe, and honouring an
 * `isPublic: true` in an uploaded file would let a file publish on the user's
 * behalf the moment they imported it. `isPublic` is not in the interchange
 * format at all for the same reason.
 *
 * Attribution is carried across as-is. A recipe that came from someone else's
 * site still says so after the round trip, and `sourceModified` survives so an
 * edited import still reads as "Adapted from" rather than claiming fidelity to
 * a source it has diverged from.
 */
export async function importRecipes(
  userId: string,
  recipes: InterchangeRecipe[],
): Promise<ImportRecipesResult> {
  const results: ImportedRecipeResult[] = [];

  // Sequential rather than Promise.all. These are writes against a serverless
  // Postgres with a connection limit, and a user restoring a full account would
  // open hundreds at once.
  for (const recipe of recipes) {
    try {
      const created = await createRecipe({
        userId,
        title: recipe.title,
        description: recipe.description ?? null,
        imageUrl: recipe.imageUrl ?? null,
        servings: recipe.servings ?? 4,
        prepTimeMinutes: recipe.prepTimeMinutes ?? null,
        cookTimeMinutes: recipe.cookTimeMinutes ?? null,
        difficulty: recipe.difficulty ?? null,
        cuisine: recipe.cuisine ?? null,
        isPublic: false,
        sourceUrl: recipe.sourceUrl ?? null,
        sourceModified: recipe.sourceModified ?? false,
        // Array position is the order. The interchange format carries no index
        // fields precisely so the two can't disagree; this is where position
        // becomes an index again.
        ingredients: (recipe.ingredients ?? []).map((ing, index) => ({
          name: ing.name,
          quantity: ing.quantity ?? null,
          unit: ing.unit ?? null,
          notes: ing.notes ?? null,
          orderIndex: index,
        })),
        steps: (recipe.steps ?? []).map((step, index) => ({
          stepNumber: index + 1,
          instruction: step.instruction,
          timerSeconds: step.timerSeconds ?? null,
          imageUrl: step.imageUrl ?? null,
        })),
        tags: recipe.tags ?? [],
      });
      results.push({ status: "imported", title: recipe.title, recipeId: created.id });
    } catch (err) {
      results.push({
        status: "failed",
        title: recipe.title,
        reason: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return {
    imported: results.filter((r) => r.status === "imported").length,
    failed: results.filter((r) => r.status === "failed").length,
    results,
  };
}
