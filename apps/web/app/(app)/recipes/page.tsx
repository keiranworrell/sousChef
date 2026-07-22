"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import type { Recipe } from "@souschef/shared";
import RecipeCard from "@/components/RecipeCard";
import EmptyState from "@/components/EmptyState";
import WelcomeModal, { shouldShowWelcome } from "@/components/WelcomeModal";
import { getApiClient } from "@/lib/api";

type SortOption = "newest" | "oldest" | "title";
type DifficultyOption = "" | "easy" | "medium" | "hard";

export default function RecipesPage(): React.JSX.Element {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search state
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filter/sort state
  const [sort, setSort] = useState<SortOption>("newest");
  const [tag, setTag] = useState("");
  const [difficulty, setDifficulty] = useState<DifficultyOption>("");

  // All unique tags from the unfiltered recipe list (for the tag dropdown)
  const [allTags, setAllTags] = useState<string[]>([]);
  const [showWelcome, setShowWelcome] = useState(false);

  // Check once on mount — must be client-side only (localStorage)
  useEffect(() => {
    setShowWelcome(shouldShowWelcome());
  }, []);

  const load = useCallback(async (params: {
    sort: SortOption;
    tag: string;
    difficulty: DifficultyOption;
    q: string;
  }): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const api = await getApiClient();
      const res = await api.recipes.list({
        sort: params.sort,
        q: params.q || undefined,
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
    void load({ sort, tag, difficulty, q });
  }, [sort, tag, difficulty, q, load]);

  function handleSearchChange(value: string): void {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setQ(value.trim()), 300);
  }

  function clearAll(): void {
    setSearchInput("");
    setQ("");
    setTag("");
    setDifficulty("");
  }

  const hasFilters = q !== "" || tag !== "" || difficulty !== "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {showWelcome && <WelcomeModal onClose={() => setShowWelcome(false)} />}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My recipes</h1>
        <Link href="/recipes/new" className="btn-primary">
          + New recipe
        </Link>
      </div>

      {/* Search bar */}
      <div className="mb-3 relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="search"
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search by title, ingredient, cuisine…"
          className="input w-full pl-9 pr-4"
        />
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
            onClick={clearAll}
            className="text-sm text-orange-500 hover:text-orange-600 font-medium"
          >
            Clear all
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-gray-400">Loading…</p>}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && recipes.length === 0 && !hasFilters && (
        <div className="space-y-3">
          <EmptyState
            icon="📖"
            title="Your recipe collection is empty"
            description="Import from any website, a photo, or plain text — or build one from scratch."
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { icon: "🔗", label: "Import from URL", href: "/recipes/new?import=url" },
              { icon: "📷", label: "From a photo", href: "/recipes/new?import=photo" },
              { icon: "📝", label: "Paste text", href: "/recipes/new?import=text" },
              { icon: "✏️", label: "Write from scratch", href: "/recipes/new" },
            ].map(({ icon, label, href }) => (
              <Link
                key={label}
                href={href}
                className="flex flex-col items-center gap-2 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 text-center hover:border-orange-200 dark:hover:border-orange-800 hover:shadow-sm transition-all"
              >
                <span className="text-2xl">{icon}</span>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 leading-snug">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {!loading && !error && recipes.length === 0 && hasFilters && (
        <div className="py-10 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {q ? `No recipes found for "${q}"` : "No recipes match your filters."}
          </p>
          <button
            onClick={clearAll}
            className="mt-2 text-sm text-orange-500 hover:underline"
          >
            Clear all
          </button>
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
