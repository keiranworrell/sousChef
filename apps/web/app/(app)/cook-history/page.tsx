"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { CookHistoryEntry } from "@souschef/shared";
import { getApiClient } from "@/lib/api";

const PAGE_SIZE = 20;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function CookHistoryPage(): React.JSX.Element {
  const [entries, setEntries] = useState<CookHistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (currentOffset: number, append: boolean): Promise<void> => {
    try {
      const api = await getApiClient();
      const res = await api.cookHistory.list({ limit: PAGE_SIZE, offset: currentOffset });
      if ("error" in res) throw new Error(res.error.message);
      setEntries((prev) => append ? [...prev, ...res.data.entries] : res.data.entries);
      setTotal(res.data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cook history");
    }
  }, []);

  useEffect(() => {
    void load(0, false).finally(() => setLoading(false));
  }, [load]);

  async function handleLoadMore(): Promise<void> {
    const nextOffset = offset + PAGE_SIZE;
    setLoadingMore(true);
    await load(nextOffset, true);
    setOffset(nextOffset);
    setLoadingMore(false);
  }

  const hasMore = entries.length < total;

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cook history</h1>
        {total > 0 && (
          <p className="mt-1 text-sm text-gray-500">
            {total} {total === 1 ? "session" : "sessions"} logged
          </p>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 px-8 py-16 text-center">
          <p className="text-gray-500">No cooks logged yet.</p>
          <p className="mt-1 text-sm text-gray-400">
            Finish a recipe and tap <span className="font-medium">Log this cook</span> to start tracking.
          </p>
          <Link
            href="/recipes"
            className="mt-6 inline-block text-sm font-medium text-orange-500 hover:underline"
          >
            Browse recipes →
          </Link>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {entries.map((entry) => (
              <li key={entry.id}>
                <Link
                  href={`/recipes/${entry.recipeId}`}
                  className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  {entry.recipe.imageUrl ? (
                    <img
                      src={entry.recipe.imageUrl}
                      alt={entry.recipe.title}
                      className="h-14 w-14 flex-shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-orange-50 text-2xl">
                      🍳
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900">{entry.recipe.title}</p>
                    <p className="mt-0.5 text-sm text-gray-400">{formatDate(entry.cookedAt)}</p>
                  </div>
                  <span className="shrink-0 text-gray-300">→</span>
                </Link>
              </li>
            ))}
          </ul>

          {hasMore && (
            <div className="mt-6 text-center">
              <button
                onClick={() => { void handleLoadMore(); }}
                disabled={loadingMore}
                className="btn-secondary disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
