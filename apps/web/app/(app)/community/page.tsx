"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CommunityRecipe } from "@souschef/shared";
import { getApiClient } from "@/lib/api";

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export default function CommunityPage(): React.JSX.Element {
  const router = useRouter();

  const [recipes, setRecipes] = useState<CommunityRecipe[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [tag, setTag] = useState("");
  const [creator, setCreator] = useState("");

  const [offset, setOffset] = useState(0);
  const limit = 20;

  const [forkingId, setForkingId] = useState<string | null>(null);
  const [forkError, setForkError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (params: { q: string; cuisine: string; tag: string; creator: string; offset: number }): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const api = await getApiClient();
        const res = await api.community.list({
          q: params.q || undefined,
          cuisine: params.cuisine || undefined,
          tag: params.tag || undefined,
          creator: params.creator || undefined,
          limit,
          offset: params.offset,
        });
        if ("error" in res) throw new Error(res.error.message);
        setRecipes(res.data.recipes);
        setTotal(res.data.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load community recipes");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Debounced search whenever filters change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setOffset(0);
      void load({ q, cuisine, tag, creator, offset: 0 });
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, cuisine, tag, creator, load]);

  // Reload when offset changes (pagination)
  useEffect(() => {
    void load({ q, cuisine, tag, creator, offset });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  async function handleFork(recipeId: string): Promise<void> {
    setForkingId(recipeId);
    setForkError(null);
    try {
      const api = await getApiClient();
      const res = await api.community.fork(recipeId);
      if ("error" in res) throw new Error(res.error.message);
      router.push(`/recipes/${res.data.id}`);
    } catch (err) {
      setForkError(err instanceof Error ? err.message : "Fork failed");
      setForkingId(null);
    }
  }

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Community recipes</h1>
        <p className="mt-1 text-sm text-gray-500">
          Browse public recipes shared by others. Fork any recipe to add it to your collection.
        </p>
      </div>

      {/* Search / filters */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          className="input flex-1"
          placeholder="Search recipes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <input
          type="text"
          className="input w-full sm:w-36"
          placeholder="Creator"
          value={creator}
          onChange={(e) => setCreator(e.target.value)}
        />
        <input
          type="text"
          className="input w-full sm:w-36"
          placeholder="Cuisine"
          value={cuisine}
          onChange={(e) => setCuisine(e.target.value)}
        />
        <input
          type="text"
          className="input w-full sm:w-36"
          placeholder="Tag"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        />
      </div>

      {forkError && (
        <p className="mb-4 text-sm text-red-600">{forkError}</p>
      )}

      {loading && <p className="text-sm text-gray-400">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && recipes.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-500">No public recipes found.</p>
        </div>
      )}

      <div className="grid gap-4">
        {recipes.map((recipe) => {
          const totalMins = (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0);
          return (
            <div
              key={recipe.id}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/community/${recipe.id}`}
                    className="text-base font-semibold text-gray-900 hover:text-orange-600 leading-snug"
                  >
                    {recipe.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-gray-400">by {recipe.creatorName}</p>
                  {recipe.description && (
                    <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                      {recipe.description}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-400">
                    <span>{recipe.servings} servings</span>
                    {totalMins > 0 && <span>{totalMins} min</span>}
                    {recipe.cuisine && <span>{recipe.cuisine}</span>}
                    {recipe.difficulty && (
                      <span className="rounded-full bg-orange-50 px-2 py-0.5 text-orange-600 font-medium">
                        {DIFFICULTY_LABEL[recipe.difficulty]}
                      </span>
                    )}
                  </div>
                  {recipe.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {recipe.tags.map((t) => (
                        <span
                          key={t.id}
                          className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500"
                        >
                          {t.tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => { void handleFork(recipe.id); }}
                  disabled={forkingId === recipe.id}
                  className="shrink-0 btn-secondary text-sm disabled:opacity-50"
                >
                  {forkingId === recipe.id ? "Forking…" : "Fork"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between text-sm text-gray-500">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="btn-secondary disabled:opacity-40"
          >
            ← Previous
          </button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={currentPage >= totalPages}
            className="btn-secondary disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
