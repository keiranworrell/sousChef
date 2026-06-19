"use client";

import Link from "next/link";
import type { Recipe } from "@souschef/shared";

type Props = {
  recipe: Recipe;
};

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export default function RecipeCard({ recipe }: Props): React.JSX.Element {
  const totalMins =
    (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0);

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold text-gray-900 leading-snug">
          {recipe.title}
        </h2>
        {recipe.difficulty && (
          <span className="shrink-0 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-600">
            {DIFFICULTY_LABEL[recipe.difficulty]}
          </span>
        )}
      </div>

      {recipe.description && (
        <p className="mt-1.5 text-sm text-gray-500 line-clamp-2">
          {recipe.description}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-400">
        <span>{recipe.servings} servings</span>
        {totalMins > 0 && <span>{totalMins} min</span>}
        {recipe.cuisine && <span>{recipe.cuisine}</span>}
      </div>
    </Link>
  );
}
