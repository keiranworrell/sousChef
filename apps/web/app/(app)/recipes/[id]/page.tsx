"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { RecipeWithDetails } from "@souschef/shared";
import { getApiClient } from "@/lib/api";

export default function RecipeDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [recipe, setRecipe] = useState<RecipeWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const api = await getApiClient();
        const res = await api.recipes.get(id);
        if ("error" in res) throw new Error(res.error.message);
        setRecipe(res.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load recipe");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id]);

  async function handleDelete(): Promise<void> {
    if (!confirm("Delete this recipe?")) return;
    setDeleting(true);
    try {
      const api = await getApiClient();
      await api.recipes.delete(id);
      router.push("/recipes");
    } catch {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-red-600">{error ?? "Recipe not found"}</p>
        <Link href="/recipes" className="mt-4 inline-block text-sm text-orange-500 hover:underline">
          ← Back to recipes
        </Link>
      </div>
    );
  }

  const totalMins = (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Link href="/recipes" className="text-sm text-orange-500 hover:underline">
            ← Recipes
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">{recipe.title}</h1>
          {recipe.description && (
            <p className="mt-2 text-gray-500">{recipe.description}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {recipe.steps.length > 0 && (
            <Link href={`/recipes/${id}/cook`} className="btn-primary">
              Start cooking
            </Link>
          )}
          <Link href={`/recipes/${id}/edit`} className="btn-secondary">
            Edit
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="btn-secondary text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      {/* Meta */}
      <div className="mb-8 flex flex-wrap gap-4 text-sm text-gray-500 border-b border-gray-100 pb-6">
        <span>{recipe.servings} servings</span>
        {totalMins > 0 && <span>{totalMins} min total</span>}
        {recipe.prepTimeMinutes && <span>{recipe.prepTimeMinutes} min prep</span>}
        {recipe.cookTimeMinutes && <span>{recipe.cookTimeMinutes} min cook</span>}
        {recipe.difficulty && <span className="capitalize">{recipe.difficulty}</span>}
        {recipe.cuisine && <span>{recipe.cuisine}</span>}
      </div>

      {/* Ingredients */}
      {recipe.ingredients.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Ingredients</h2>
          <ul className="space-y-2">
            {recipe.ingredients.map((ing) => (
              <li key={ing.id} className="flex gap-2 text-sm text-gray-700">
                {ing.quantity != null && (
                  <span className="font-medium text-gray-900">
                    {ing.quantity}{ing.unit ? ` ${ing.unit}` : ""}
                  </span>
                )}
                <span>{ing.name}</span>
                {ing.notes && <span className="text-gray-400">({ing.notes})</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Steps */}
      {recipe.steps.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Method</h2>
          <ol className="space-y-4">
            {recipe.steps.map((step) => (
              <li key={step.id} className="flex gap-4">
                <span className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-600">
                  {step.stepNumber}
                </span>
                <div className="pt-0.5">
                  <p className="text-sm text-gray-700">{step.instruction}</p>
                  {step.timerSeconds && (
                    <p className="mt-1 text-xs text-gray-400">
                      Timer: {Math.round(step.timerSeconds / 60)} min
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
