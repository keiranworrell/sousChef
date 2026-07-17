"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { PublicCollectionWithItems, CollectionRecipeItem } from "@souschef/shared";
import { getApiClient } from "@/lib/api";

export default function PublicCollectionPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [collection, setCollection] = useState<PublicCollectionWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forkingId, setForkingId] = useState<string | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const api = await getApiClient();
        const res = await api.collections.getPublic(id);
        if ("error" in res) throw new Error(res.error.message);
        setCollection(res.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Collection not found");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id]);

  async function handleFork(recipeId: string): Promise<void> {
    setForkingId(recipeId);
    try {
      const api = await getApiClient();
      const res = await api.community.fork(recipeId);
      if ("error" in res) throw new Error(res.error.message);
      router.push(`/recipes/${res.data.id}`);
    } catch {
      setForkingId(null);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-red-600">{error ?? "Collection not found"}</p>
        <Link href="/community" className="mt-4 inline-block text-sm text-orange-500 hover:underline">
          ← Community
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/community?tab=collections" className="text-sm text-orange-500 hover:underline">
        ← Collections
      </Link>

      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 break-words">{collection.name}</h1>
        {collection.description && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{collection.description}</p>
        )}
        <p className="mt-2 text-xs text-gray-400">
          by{" "}
          <Link href={`/users/${collection.ownerId}`} className="text-orange-500 hover:underline">
            {collection.ownerName}
          </Link>
          {" · "}{collection.recipeCount} {collection.recipeCount === 1 ? "recipe" : "recipes"}
        </p>
      </div>

      {collection.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 py-16 text-center">
          <p className="text-sm text-gray-400">No recipes in this collection yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {collection.items.map((item: CollectionRecipeItem) => (
            <div
              key={item.recipeId}
              className="flex items-center gap-3 rounded-lg border border-gray-100 dark:border-gray-800 p-3"
            >
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.title} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="h-14 w-14 shrink-0 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xl">🍽️</div>
              )}
              <div className="min-w-0 flex-1">
                <Link
                  href={`/community/${item.recipeId}`}
                  className="truncate text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-orange-600 transition-colors"
                >
                  {item.title}
                </Link>
                <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-gray-400">
                  {item.cookTimeMinutes && <span>{item.cookTimeMinutes} min</span>}
                  {item.difficulty && <span className="capitalize">{item.difficulty}</span>}
                  {item.cuisine && <span>{item.cuisine}</span>}
                </div>
              </div>
              <button
                onClick={() => { void handleFork(item.recipeId); }}
                disabled={forkingId === item.recipeId}
                className="shrink-0 btn-secondary text-sm disabled:opacity-50"
              >
                {forkingId === item.recipeId ? "Forking…" : "Fork"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
