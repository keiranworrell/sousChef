"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Recipe } from "@souschef/shared";
import { getApiClient } from "@/lib/api";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import InfiniteListFooter, { ListSkeleton } from "@/components/InfiniteListFooter";

type Props = {
  collectionId: string;
  /** Recipe ids already in the collection, so they open pre-ticked. */
  initialMemberIds: string[];
  onClose: () => void;
  /** Called after a successful save, with the resulting membership. */
  onSaved: (memberIds: string[]) => void;
};

/**
 * Searchable, paginated picker for changing which recipes are in a collection.
 *
 * The counterpart to CollectionPickerModal: that one answers "which collections
 * hold this recipe", this one answers "which recipes are in this collection".
 * Both diff against server state rather than trusting local state — the bug
 * fixed in PR #126 came from doing otherwise.
 *
 * Changes are staged locally and applied in one request on save. Applying each
 * tick immediately would mean dozens of requests while the user works through a
 * long list, and no way to back out of a mis-click.
 */
export default function RecipeMultiSelectModal({
  collectionId,
  initialMemberIds,
  onClose,
  onSaved,
}: Props): React.JSX.Element {
  // Membership as it stood when the modal opened — the baseline for the diff
  const [baseline] = useState<Set<string>>(() => new Set(initialMemberIds));
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialMemberIds));

  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setQ(searchInput.trim()), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  const fetchPage = useCallback(
    async (cursor: string | null) => {
      const api = await getApiClient();
      const res = await api.recipes.list({
        q: q || undefined,
        cursor: cursor ?? undefined,
        limit: 20,
        sort: "newest",
      });
      if ("error" in res) throw new Error(res.error.message);
      return {
        items: res.data.recipes,
        nextCursor: res.data.nextCursor,
        total: res.data.total,
      };
    },
    [q],
  );

  const {
    items: recipes,
    isLoadingInitial,
    isLoadingMore,
    error: listError,
    hasMore,
    retry,
    sentinelRef,
  } = useInfiniteList<Recipe>({
    fetchPage,
    resetKey: q,
    getItemKey: (r) => r.id,
    // No cacheKey: a modal is short-lived, and restoring a stale list here would
    // be confusing rather than helpful.
  });

  function toggle(recipeId: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(recipeId)) next.delete(recipeId);
      else next.add(recipeId);
      return next;
    });
  }

  // Diff against the opening state, so only genuine changes are sent
  const toAdd = [...selected].filter((id) => !baseline.has(id));
  const toRemove = [...baseline].filter((id) => !selected.has(id));
  const hasChanges = toAdd.length > 0 || toRemove.length > 0;

  async function handleSave(): Promise<void> {
    if (!hasChanges) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const api = await getApiClient();
      const res = await api.collections.updateRecipes(collectionId, {
        add: toAdd,
        remove: toRemove,
      });
      if ("error" in res) throw new Error(res.error.message);
      onSaved([...selected]);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-xl dark:bg-gray-900 sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Add recipes
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-800">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search your recipes…"
            className="input w-full text-sm"
            autoFocus
          />
        </div>

        {/* List */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          {isLoadingInitial && (
            <div className="space-y-2 p-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <ListSkeleton key={i} variant="row" />
              ))}
            </div>
          )}

          {listError && recipes.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-sm text-red-600">{listError}</p>
              <button onClick={retry} className="mt-2 text-sm text-orange-500 hover:underline">
                Try again
              </button>
            </div>
          )}

          {!isLoadingInitial && !listError && recipes.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400">
              {q ? `No recipes match “${q}”` : "You have no recipes yet."}
            </p>
          )}

          {recipes.map((recipe) => {
            const isSelected = selected.has(recipe.id);
            return (
              <button
                key={recipe.id}
                type="button"
                onClick={() => toggle(recipe.id)}
                aria-pressed={isSelected}
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  isSelected
                    ? "border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950"
                    : "border-transparent hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs font-bold ${
                    isSelected
                      ? "border-orange-500 bg-orange-500 text-white"
                      : "border-gray-300 text-transparent dark:border-gray-600"
                  }`}
                >
                  ✓
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                    {recipe.title}
                  </span>
                  {recipe.cuisine && (
                    <span className="block truncate text-xs text-gray-400">{recipe.cuisine}</span>
                  )}
                </span>
              </button>
            );
          })}

          {recipes.length > 0 && (
            <InfiniteListFooter
              isLoadingMore={isLoadingMore}
              hasMore={hasMore}
              error={listError}
              onRetry={retry}
              sentinelRef={sentinelRef}
              itemCount={recipes.length}
              variant="row"
            />
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-5 py-4 dark:border-gray-800">
          {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
          <div className="flex items-center justify-between gap-3">
            {/* Naming both directions, because "3 changes" hides whether the
                user is about to remove something they didn't mean to. */}
            <p className="min-w-0 flex-1 text-xs text-gray-400">
              {hasChanges
                ? [
                    toAdd.length > 0 ? `${toAdd.length} to add` : null,
                    toRemove.length > 0 ? `${toRemove.length} to remove` : null,
                  ]
                    .filter(Boolean)
                    .join(", ")
                : "No changes"}
            </p>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={onClose} className="btn-secondary text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { void handleSave(); }}
                disabled={saving || !hasChanges}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
