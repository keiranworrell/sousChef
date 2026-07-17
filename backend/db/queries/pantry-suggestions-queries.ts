/**
 * Pantry-to-recipe suggestion queries.
 *
 * Matches the user's pantry items against recipe ingredient lists using
 * case-insensitive substring matching, then ranks results by the fraction
 * of recipe ingredients covered by pantry items.
 *
 * No AI involved — pure SQL + in-process scoring.
 */

import { eq, and, isNull, ne } from "drizzle-orm";
import { getDb } from "../client";
import { recipes, recipeIngredients, recipeTags, pantryItems } from "../schema";

// ── Types ──────────────────────────────────────────────────────────────────────

export type SuggestedRecipe = {
  id: string;
  title: string;
  imageUrl: string | null;
  cuisine: string | null;
  difficulty: "easy" | "medium" | "hard" | null;
  cookTimeMinutes: number | null;
  tags: string[];
  /** Number of recipe ingredients covered by the pantry. */
  matchCount: number;
  /** Total number of recipe ingredients. */
  totalIngredients: number;
  /** matchCount / totalIngredients, 0–1. */
  matchRatio: number;
};

export type PantrySuggestionsResult = {
  savedRecipes: SuggestedRecipe[];
  communityRecipes: SuggestedRecipe[];
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Normalise an ingredient name for comparison: lowercase, strip punctuation. */
function normalise(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}

/**
 * Returns true if any pantry item name is contained in the ingredient name
 * or vice versa (handles "ripe bananas" matching pantry item "bananas").
 */
function ingredientMatchesPantry(
  ingredientName: string,
  pantryNames: string[],
): boolean {
  const normIng = normalise(ingredientName);
  for (const pantryName of pantryNames) {
    const normPantry = normalise(pantryName);
    if (normIng.includes(normPantry) || normPantry.includes(normIng)) {
      return true;
    }
  }
  return false;
}

type RawRecipeRow = {
  id: string;
  title: string;
  imageUrl: string | null;
  cuisine: string | null;
  difficulty: "easy" | "medium" | "hard" | null;
  cookTimeMinutes: number | null;
};

type RawIngredientRow = {
  recipeId: string;
  name: string;
};

type RawTagRow = {
  recipeId: string;
  tag: string;
};

function scoreRecipes(
  recipeRows: RawRecipeRow[],
  ingredientRows: RawIngredientRow[],
  tagRows: RawTagRow[],
  pantryNames: string[],
): SuggestedRecipe[] {
  // Group ingredients and tags by recipe ID
  const ingredientsByRecipe = new Map<string, string[]>();
  for (const row of ingredientRows) {
    const list = ingredientsByRecipe.get(row.recipeId) ?? [];
    list.push(row.name);
    ingredientsByRecipe.set(row.recipeId, list);
  }

  const tagsByRecipe = new Map<string, string[]>();
  for (const row of tagRows) {
    const list = tagsByRecipe.get(row.recipeId) ?? [];
    list.push(row.tag);
    tagsByRecipe.set(row.recipeId, list);
  }

  const results: SuggestedRecipe[] = [];

  for (const recipe of recipeRows) {
    const ingredients = ingredientsByRecipe.get(recipe.id) ?? [];
    if (ingredients.length === 0) continue;

    const matchCount = ingredients.filter((ing) =>
      ingredientMatchesPantry(ing, pantryNames),
    ).length;

    // Only include recipes where at least one ingredient is matched
    if (matchCount === 0) continue;

    results.push({
      id: recipe.id,
      title: recipe.title,
      imageUrl: recipe.imageUrl,
      cuisine: recipe.cuisine,
      difficulty: recipe.difficulty,
      cookTimeMinutes: recipe.cookTimeMinutes,
      tags: tagsByRecipe.get(recipe.id) ?? [],
      matchCount,
      totalIngredients: ingredients.length,
      matchRatio: matchCount / ingredients.length,
    });
  }

  // Sort by match ratio descending, then by matchCount descending
  results.sort((a, b) =>
    b.matchRatio !== a.matchRatio
      ? b.matchRatio - a.matchRatio
      : b.matchCount - a.matchCount,
  );

  return results;
}

// ── Public API ─────────────────────────────────────────────────────────────────

const MAX_RESULTS = 20;

/**
 * Returns up to 20 saved recipes and 20 community recipes that can be
 * (at least partially) made from the user's current pantry.
 */
export async function getPantrySuggestions(
  userId: string,
  householdId: string | null,
): Promise<PantrySuggestionsResult> {
  const db = await getDb();

  // 1. Fetch pantry items
  const pantryWhere = householdId
    ? eq(pantryItems.householdId, householdId)
    : and(eq(pantryItems.userId, userId), isNull(pantryItems.householdId));

  const pantryRows = await db
    .select({ name: pantryItems.name })
    .from(pantryItems)
    .where(pantryWhere);

  if (pantryRows.length === 0) {
    return { savedRecipes: [], communityRecipes: [] };
  }

  const pantryNames = pantryRows.map((r) => r.name);

  // 2. Saved recipes — fetch all the user's recipes with their ingredients and tags
  const savedRecipeRows = await db
    .select({
      id: recipes.id,
      title: recipes.title,
      imageUrl: recipes.imageUrl,
      cuisine: recipes.cuisine,
      difficulty: recipes.difficulty,
      cookTimeMinutes: recipes.cookTimeMinutes,
    })
    .from(recipes)
    .where(eq(recipes.userId, userId));

  const [savedIngRows, savedTagRows] = savedRecipeRows.length > 0
    ? await Promise.all([
        db
          .select({ recipeId: recipeIngredients.recipeId, name: recipeIngredients.name })
          .from(recipeIngredients)
          .innerJoin(recipes, eq(recipeIngredients.recipeId, recipes.id))
          .where(eq(recipes.userId, userId)),
        db
          .select({ recipeId: recipeTags.recipeId, tag: recipeTags.tag })
          .from(recipeTags)
          .innerJoin(recipes, eq(recipeTags.recipeId, recipes.id))
          .where(eq(recipes.userId, userId)),
      ])
    : [[], []];

  const savedSuggestions = scoreRecipes(
    savedRecipeRows,
    savedIngRows,
    savedTagRows,
    pantryNames,
  ).slice(0, MAX_RESULTS);

  // 3. Community recipes — public recipes by other users
  const communityRecipeRows = await db
    .select({
      id: recipes.id,
      title: recipes.title,
      imageUrl: recipes.imageUrl,
      cuisine: recipes.cuisine,
      difficulty: recipes.difficulty,
      cookTimeMinutes: recipes.cookTimeMinutes,
    })
    .from(recipes)
    .where(and(eq(recipes.isPublic, true), ne(recipes.userId, userId)));

  const [communityIngRows, communityTagRows] = communityRecipeRows.length > 0
    ? await Promise.all([
        db
          .select({ recipeId: recipeIngredients.recipeId, name: recipeIngredients.name })
          .from(recipeIngredients)
          .innerJoin(recipes, eq(recipeIngredients.recipeId, recipes.id))
          .where(and(eq(recipes.isPublic, true), ne(recipes.userId, userId))),
        db
          .select({ recipeId: recipeTags.recipeId, tag: recipeTags.tag })
          .from(recipeTags)
          .innerJoin(recipes, eq(recipeTags.recipeId, recipes.id))
          .where(and(eq(recipes.isPublic, true), ne(recipes.userId, userId))),
      ])
    : [[], []];

  const communitySuggestions = scoreRecipes(
    communityRecipeRows,
    communityIngRows,
    communityTagRows,
    pantryNames,
  ).slice(0, MAX_RESULTS);

  return {
    savedRecipes: savedSuggestions,
    communityRecipes: communitySuggestions,
  };
}
