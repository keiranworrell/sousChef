"use client";

import React, { useState } from "react";
import type { CookLogEntry } from "@souschef/shared";
import { getApiClient } from "@/lib/api";

type Props = {
  recipeId: string;
  entries: CookLogEntry[];
  loading: boolean;
  error: string | null;
  onRemoved: (entryId: string) => void;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function Stars({ rating }: { rating: number }): React.JSX.Element {
  return (
    <span className="text-orange-400" aria-label={`${rating} out of 5`}>
      {"★".repeat(rating)}
      <span className="text-gray-200 dark:text-gray-700">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

/**
 * The user's own cooks of this recipe. Private — it renders on the app's recipe
 * page and never on the public or short-link views, because notes like "too
 * salty, halve the soy" are a private working note on someone else's recipe.
 */
export default function CookLogPanel({
  recipeId,
  entries,
  loading,
  error,
  onRemoved,
}: Props): React.JSX.Element | null {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  async function handleRemove(entryId: string): Promise<void> {
    if (!confirm("Delete this cook log entry?")) return;
    setRemovingId(entryId);
    setRemoveError(null);
    try {
      const api = await getApiClient();
      const res = await api.recipes.deleteCookLogEntry(recipeId, entryId);
      if ("error" in res) throw new Error(res.error.message);
      onRemoved(entryId);
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : "Could not delete that entry");
    } finally {
      setRemovingId(null);
    }
  }

  // A failed load has to say so. Rendering nothing would be indistinguishable
  // from "you've never cooked this", which is a different and misleading claim.
  if (error) {
    return (
      <section className="mt-10 border-t border-gray-100 dark:border-gray-800 pt-6">
        <h2 className="mb-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Your cook log
        </h2>
        <p className="text-sm text-red-600">{error}</p>
      </section>
    );
  }

  // Nothing yet and nothing in flight: stay out of the way. The "Log cook"
  // action is the entry point, so an empty panel would be pure furniture.
  if (loading || entries.length === 0) return null;

  return (
    <section className="mt-10 border-t border-gray-100 dark:border-gray-800 pt-6">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Your cook log
        </h2>
        <span className="text-xs text-gray-400">
          {entries.length} {entries.length === 1 ? "cook" : "cooks"} · private to you
        </span>
      </div>

      {removeError && <p className="mb-2 text-sm text-red-600">{removeError}</p>}

      <ul className="divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-gray-100 dark:border-gray-800">
        {entries.map((entry) => {
          const isExpanded = expandedId === entry.id;
          const hasNotes = Boolean(entry.notes);
          return (
            <li key={entry.id}>
              <div className="flex items-center gap-3 px-4 py-2.5">
                {/* The whole row is the toggle only when there's something to
                    reveal; otherwise it's static text and shouldn't offer a
                    click that does nothing. */}
                {hasNotes ? (
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    aria-expanded={isExpanded}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span className="text-sm tabular-nums text-gray-700 dark:text-gray-300">
                      {formatDate(entry.cookedAt)}
                    </span>
                    {entry.rating !== null && <Stars rating={entry.rating} />}
                    <span className="ml-auto shrink-0 text-xs text-gray-400">
                      {isExpanded ? "Hide notes" : "Notes"}
                    </span>
                  </button>
                ) : (
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="text-sm tabular-nums text-gray-700 dark:text-gray-300">
                      {formatDate(entry.cookedAt)}
                    </span>
                    {entry.rating !== null && <Stars rating={entry.rating} />}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => { void handleRemove(entry.id); }}
                  disabled={removingId === entry.id}
                  className="shrink-0 text-gray-300 transition-colors hover:text-red-400 disabled:opacity-50"
                  aria-label={`Delete cook log entry from ${formatDate(entry.cookedAt)}`}
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none">
                    <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              {isExpanded && entry.notes && (
                <p className="whitespace-pre-wrap px-4 pb-3 text-sm text-gray-600 dark:text-gray-400">
                  {entry.notes}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
