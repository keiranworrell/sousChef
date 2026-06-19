"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { Recipe } from "@souschef/shared";
import RecipeCard from "@/components/RecipeCard";
import { getApiClient } from "@/lib/api";

export default function RecipesPage(): React.JSX.Element {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const api = await getApiClient();
        const res = await api.recipes.list();
        if ("error" in res) throw new Error(res.error.message);
        setRecipes(res.data.recipes);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load recipes");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My recipes</h1>
        <Link href="/recipes/new" className="btn-primary">
          + New recipe
        </Link>
      </div>

      {loading && (
        <p className="text-sm text-gray-400">Loading…</p>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {!loading && !error && recipes.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-500">No recipes yet.</p>
          <Link href="/recipes/new" className="mt-4 inline-block btn-primary">
            Add your first recipe
          </Link>
        </div>
      )}

      <div className="grid gap-4">
        {recipes.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} />
        ))}
      </div>
    </div>
  );
}
