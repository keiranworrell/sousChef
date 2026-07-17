"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { PantrySuggestionsResponse, SuggestedRecipe } from "@souschef/shared";
import { getApiClient } from "@/lib/api";

type Props = {
  onClose: () => void;
};

type Tab = "saved" | "community";

function MatchBadge({ matchCount, totalIngredients, matchRatio }: {
  matchCount: number;
  totalIngredients: number;
  matchRatio: number;
}): React.JSX.Element {
  const pct = Math.round(matchRatio * 100);
  const colour =
    pct >= 80 ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400" :
    pct >= 50 ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400" :
    "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${colour}`}>
      {matchCount}/{totalIngredients} ingredients ({pct}%)
    </span>
  );
}

function RecipeRow({ recipe, href }: { recipe: SuggestedRecipe; href: string }): React.JSX.Element {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-gray-100 p-3 hover:border-orange-200 hover:bg-orange-50 transition-colors dark:border-gray-800 dark:hover:border-orange-800 dark:hover:bg-orange-950"
    >
      {recipe.imageUrl ? (
        <img
          src={recipe.imageUrl}
          alt={recipe.title}
          className="h-14 w-14 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="h-14 w-14 shrink-0 rounded-lg bg-gray-100 flex items-center justify-center text-xl dark:bg-gray-800">
          🍽️
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{recipe.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <MatchBadge
            matchCount={recipe.matchCount}
            totalIngredients={recipe.totalIngredients}
            matchRatio={recipe.matchRatio}
          />
          {recipe.cookTimeMinutes && (
            <span className="text-xs text-gray-400">{recipe.cookTimeMinutes} min</span>
          )}
          {recipe.difficulty && (
            <span className="text-xs capitalize text-gray-400">{recipe.difficulty}</span>
          )}
        </div>
      </div>
      <span className="shrink-0 text-gray-300">→</span>
    </Link>
  );
}

export default function WhatCanICookModal({ onClose }: Props): React.JSX.Element {
  const [tab, setTab] = useState<Tab>("saved");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PantrySuggestionsResponse | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const api = await getApiClient();
        const res = await api.pantry.suggestions();
        if ("error" in res) throw new Error(res.error.message);
        setSuggestions(res.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load suggestions");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const savedRecipes = suggestions?.savedRecipes ?? [];
  const communityRecipes = suggestions?.communityRecipes ?? [];
  const activeList = tab === "saved" ? savedRecipes : communityRecipes;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="flex w-full max-w-lg flex-col rounded-xl bg-white shadow-xl dark:bg-gray-900" style={{ maxHeight: "80vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">What can I cook?</h2>
            <p className="text-xs text-gray-400">Based on what&apos;s in your pantry</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setTab("saved")}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              tab === "saved"
                ? "border-b-2 border-orange-500 text-orange-600"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            My recipes
            {!loading && savedRecipes.length > 0 && (
              <span className="ml-1.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-600 dark:bg-orange-950 dark:text-orange-400">
                {savedRecipes.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab("community")}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              tab === "community"
                ? "border-b-2 border-orange-500 text-orange-600"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            Community
            {!loading && communityRecipes.length > 0 && (
              <span className="ml-1.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-600 dark:bg-orange-950 dark:text-orange-400">
                {communityRecipes.length}
              </span>
            )}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-gray-400">Finding recipes…</p>
          ) : error ? (
            <p className="py-8 text-center text-sm text-red-600">{error}</p>
          ) : activeList.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-500">
                {tab === "saved"
                  ? "No matches found in your recipes. Try adding more items to your pantry."
                  : "No community recipes match your pantry right now."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeList.map((recipe) => (
                <RecipeRow
                  key={recipe.id}
                  recipe={recipe}
                  href={tab === "saved" ? `/recipes/${recipe.id}` : `/community/${recipe.id}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
