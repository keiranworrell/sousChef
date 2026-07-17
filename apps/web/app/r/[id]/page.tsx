"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { CommunityRecipe } from "@souschef/shared";
import { getApiClient } from "@/lib/api";

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export default function PublicRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}): React.JSX.Element {
  const [id, setId] = useState<string | null>(null);
  const [recipe, setRecipe] = useState<CommunityRecipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function resolveParams(): Promise<void> {
      const { id: resolvedId } = await params;
      setId(resolvedId);
    }
    void resolveParams();
  }, [params]);

  useEffect(() => {
    if (!id) return;
    async function load(): Promise<void> {
      try {
        const api = await getApiClient();
        const res = await api.public.getRecipe(id!);
        if ("error" in res) throw new Error(res.error.message);
        setRecipe(res.data);
      } catch {
        setError("Recipe not found or is not available.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Recipe not found</p>
        <p className="text-gray-500 mb-6">This recipe may have been made private or removed.</p>
        <Link href="/sign-in" className="btn-primary">
          Sign in to sousChef
        </Link>
      </div>
    );
  }

  const totalMins = (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <Link
          href="/"
          className="text-lg font-bold text-orange-500 tracking-tight flex items-center gap-2"
        >
          sousChef
        </Link>
        <Link href="/sign-in" className="btn-primary text-sm">
          Sign in to save & cook
        </Link>
      </div>

      {recipe.imageUrl && (
        <img
          src={recipe.imageUrl}
          alt={recipe.title}
          className="w-full h-64 object-cover rounded-xl mb-6"
        />
      )}

      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{recipe.title}</h1>
      <p className="mt-1 text-sm text-gray-400">by {recipe.creatorName}</p>

      {recipe.description && (
        <p className="mt-3 text-gray-600 dark:text-gray-400">{recipe.description}</p>
      )}

      {recipe.sourceUrl && (
        <a
          href={recipe.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block text-xs text-gray-400 hover:text-orange-500 hover:underline"
        >
          ↗ Original source: {new URL(recipe.sourceUrl).hostname.replace(/^www\./, "")}
        </a>
      )}

      {/* Meta */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-500">
        <span>{recipe.servings} servings</span>
        {totalMins > 0 && <span>{totalMins} min total</span>}
        {recipe.prepTimeMinutes != null && recipe.prepTimeMinutes > 0 && (
          <span>{recipe.prepTimeMinutes} min prep</span>
        )}
        {recipe.cookTimeMinutes != null && recipe.cookTimeMinutes > 0 && (
          <span>{recipe.cookTimeMinutes} min cook</span>
        )}
        {recipe.difficulty && (
          <span className="capitalize">{DIFFICULTY_LABEL[recipe.difficulty]}</span>
        )}
        {recipe.cuisine && <span>{recipe.cuisine}</span>}
      </div>

      {recipe.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {recipe.tags.map((t) => (
            <span
              key={t.id}
              className="rounded-full bg-orange-50 dark:bg-orange-950 px-2.5 py-0.5 text-xs font-medium text-orange-600 dark:text-orange-400"
            >
              {t.tag}
            </span>
          ))}
        </div>
      )}

      <div className="my-8 border-b border-gray-100 dark:border-gray-800" />

      {/* Ingredients */}
      {recipe.ingredients.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Ingredients</h2>
          <ul className="space-y-2">
            {recipe.ingredients.map((ing) => (
              <li key={ing.id} className="flex gap-2 text-sm text-gray-700 dark:text-gray-300">
                {ing.quantity != null && (
                  <span className="font-medium text-gray-900 dark:text-gray-100">
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
        <section className="mb-12">
          <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Method</h2>
          <ol className="space-y-4">
            {recipe.steps.map((step) => (
              <li key={step.id} className="flex gap-4">
                <span className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-600">
                  {step.stepNumber}
                </span>
                <div className="pt-0.5">
                  <p className="text-sm text-gray-700 dark:text-gray-300">{step.instruction}</p>
                  {step.timerSeconds != null && step.timerSeconds > 0 && (
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

      {/* CTA */}
      <div className="rounded-xl border border-orange-100 bg-orange-50 p-6 text-center">
        <p className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Like this recipe?</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Sign up to sousChef to save it, scale it, and get step-by-step cooking mode.
        </p>
        <Link href="/sign-up" className="btn-primary">
          Get started free
        </Link>
      </div>
    </div>
  );
}
