"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { RecipeWithDetails } from "@souschef/shared";
import RecipeForm from "@/components/RecipeForm";
import { getApiClient } from "@/lib/api";

export default function EditRecipePage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const [recipe, setRecipe] = useState<RecipeWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href={`/recipes/${id}`} className="text-sm text-orange-500 hover:underline">
        ← Back to recipe
      </Link>
      <h1 className="mt-2 mb-8 text-2xl font-bold text-gray-900 dark:text-gray-100">Edit recipe</h1>
      <RecipeForm initial={recipe} />
    </div>
  );
}
