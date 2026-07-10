"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { RediscoverMode, RediscoverRecipe } from "@souschef/shared";
import { getApiClient } from "@/lib/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) === 1 ? "" : "s"} ago`;
  if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) === 1 ? "" : "s"} ago`;
  return `${Math.floor(days / 365)} year${Math.floor(days / 365) === 1 ? "" : "s"} ago`;
}

const DIFFICULTY_LABEL = { easy: "Easy", medium: "Medium", hard: "Hard" } as const;

// ── Recipe card ───────────────────────────────────────────────────────────────

function RediscoverCard({
  recipe,
  showLastCooked,
}: {
  recipe: RediscoverRecipe;
  showLastCooked: boolean;
}): React.JSX.Element {
  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="block rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md overflow-hidden"
    >
      {recipe.imageUrl ? (
        <img
          src={recipe.imageUrl}
          alt={recipe.title}
          className="w-full h-40 object-cover"
        />
      ) : (
        <div className="w-full h-40 bg-orange-50 flex items-center justify-center text-4xl">
          🍳
        </div>
      )}
      <div className="p-4">
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

        <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-400">
          {recipe.cookTimeMinutes && <span>{recipe.cookTimeMinutes} min</span>}
          {recipe.cuisine && <span>{recipe.cuisine}</span>}
          {showLastCooked && recipe.lastCookedAt && (
            <span className="text-orange-400">Last cooked {timeAgo(recipe.lastCookedAt)}</span>
          )}
        </div>

        {recipe.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {recipe.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-600"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const MODES: { value: RediscoverMode; label: string; emptyTitle: string; emptyBody: string }[] = [
  {
    value: "cook-again",
    label: "Cook again",
    emptyTitle: "Nothing to rediscover yet",
    emptyBody: "Log some cooks and they'll appear here, starting with the ones you haven't made in a while.",
  },
  {
    value: "never-tried",
    label: "Never tried",
    emptyTitle: "You've cooked everything!",
    emptyBody: "All your recipes have a cook logged. Add more recipes to see them here.",
  },
];

export default function RediscoverPage(): React.JSX.Element {
  const [mode, setMode] = useState<RediscoverMode>("cook-again");
  const [recipes, setRecipes] = useState<RediscoverRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const api = await getApiClient();
        const res = await api.recipes.rediscover(mode);
        if (cancelled) return;
        if ("error" in res) throw new Error(res.error.message);
        setRecipes(res.data.recipes);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [mode]);

  const currentMode = MODES.find((m) => m.value === mode)!;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Rediscover</h1>

      {/* Mode toggle */}
      <div className="mb-8 flex rounded-xl bg-gray-100 p-1 w-fit">
        {MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => setMode(m.value)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
              mode === m.value
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : recipes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 px-8 py-16 text-center">
          <p className="font-medium text-gray-700">{currentMode.emptyTitle}</p>
          <p className="mt-2 text-sm text-gray-400">{currentMode.emptyBody}</p>
          <Link href="/recipes" className="mt-6 inline-block text-sm font-medium text-orange-500 hover:underline">
            Browse recipes →
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {recipes.map((recipe) => (
            <RediscoverCard
              key={recipe.id}
              recipe={recipe}
              showLastCooked={mode === "cook-again"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
