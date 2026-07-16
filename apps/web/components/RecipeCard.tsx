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
      className="block rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md overflow-hidden"
    >
      {recipe.imageUrl && (
        <img
          src={recipe.imageUrl}
          alt={recipe.title}
          className="w-full h-40 object-cover"
        />
      )}
      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-900 leading-snug">
            {recipe.title}
          </h2>
          <div className="flex shrink-0 gap-1.5">
            {recipe.isPublic && (
              <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-600">
                Public
              </span>
            )}
            {recipe.difficulty && (
              <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-600">
                {DIFFICULTY_LABEL[recipe.difficulty]}
              </span>
            )}
          </div>
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

        {recipe.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {recipe.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-600"
              >
                {tag}
              </span>
            ))}
            {recipe.tags.length > 3 && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                +{recipe.tags.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
