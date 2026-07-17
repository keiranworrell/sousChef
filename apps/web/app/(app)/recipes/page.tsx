"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { Recipe } from "@souschef/shared";
import RecipeCard from "@/components/RecipeCard";
import { getApiClient } from "@/lib/api";

type SortOption = "newest" | "oldest" | "title";
type DifficultyOption = "" | "easy" | "medium" | "hard";

export default function RecipesPage(): React.JSX.Element {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter/sort state
  const [sort, setSort] = useState<SortOption>("newest");
  const [tag, setTag] = useState("");
  const [difficulty, setDifficulty] = useState<DifficultyOption>("");

  // All unique tags from the unfiltered recipe list (for the tag dropdown)
  const [allTags, setAllTags] = useState<string[]>([]);

  const load = useCallback(async (params: {
    sort: SortOption;
    tag: string;
    difficulty: DifficultyOption;
  }): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const api = await getApiClient();
      const res = await api.recipes.list({
        sort: params.sort,
        tag: params.tag || undefined,
        difficulty: params.difficulty || undefined,
      });
      if ("error" in res) throw new Error(res.error.message);
      setRecipes(res.data.recipes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recipes");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load all tags once on mount (unfiltered) to populate the tag dropdown
  useEffect(() => {
    async function loadTags(): Promise<void> {
      try {
        const api = await getApiClient();
        const res = await api.recipes.list({ sort: "newest" });
        if ("data" in res) {
          const tags = Array.from(
            new Set(res.data.recipes.flatMap((r) => r.tags)),
          ).sort();
          setAllTags(tags);
        }
      } catch {
        // non-critical
      }
    }
    void loadTags();
  }, []);

  useEffect(() => {
    void load({ sort, tag, difficulty });
  }, [sort, tag, difficulty, load]);

  const hasFilters = tag !== "" || difficulty !== "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My recipes</h1>
        <Link href="/recipes/new" className="btn-primary">
          + New recipe
        </Link>
      </div>

      {/* Filter / sort bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="input w-auto text-sm"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="title">A – Z</option>
        </select>

        {allTags.length > 0 && (
          <select
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            className="input w-auto text-sm"
          >
            <option value="">All tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}

        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as DifficultyOption)}
          className="input w-auto text-sm"
        >
          <option value="">Any difficulty</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>

        {hasFilters && (
          <button
            onClick={() => { setTag(""); setDifficulty(""); }}
            className="text-sm text-orange-500 hover:text-orange-600 font-medium"
          >
            Clear filters
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-gray-400">Loading…</p>}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && recipes.length === 0 && !hasFilters && (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">No recipes yet.</p>
          <Link href="/recipes/new" className="mt-4 inline-block btn-primary">
            Add your first recipe
          </Link>
        </div>
      )}

      {!loading && !error && recipes.length === 0 && hasFilters && (
        <p className="text-sm text-gray-500 dark:text-gray-400">No recipes match your filters.</p>
      )}

      <div className="grid gap-4">
        {recipes.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} />
        ))}
      </div>
    </div>
  );
}
