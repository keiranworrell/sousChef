"use client";

import React, { useEffect, useState } from "react";
import type { CollectionSummary } from "@souschef/shared";
import { getApiClient } from "@/lib/api";

type Props = {
  recipeId: string;
  onClose: () => void;
};

export default function CollectionPickerModal({ recipeId, onClose }: Props): React.JSX.Element {
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Which collection IDs already contain this recipe
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());

  // Adding / removing state
  const [pendingId, setPendingId] = useState<string | null>(null);

  // New collection inline form
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const api = await getApiClient();
        const [listRes, memberRes] = await Promise.all([
          api.collections.list(),
          api.collections.forRecipe(recipeId),
        ]);
        if ("error" in listRes) throw new Error(listRes.error.message);
        setCollections(listRes.data.collections);
        if (!("error" in memberRes)) {
          setMemberIds(new Set(memberRes.data.collectionIds));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load collections");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [recipeId]);

  async function toggleCollection(collectionId: string): Promise<void> {
    setPendingId(collectionId);
    try {
      const api = await getApiClient();
      if (memberIds.has(collectionId)) {
        await api.collections.removeRecipe(collectionId, recipeId);
        setMemberIds((prev) => { const next = new Set(prev); next.delete(collectionId); return next; });
      } else {
        await api.collections.addRecipe(collectionId, recipeId);
        setMemberIds((prev) => new Set([...prev, collectionId]));
      }
    } catch {
      // swallow — UI stays consistent with server on next load
    } finally {
      setPendingId(null);
    }
  }

  async function handleCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreateError(null);
    setCreateSaving(true);
    try {
      const api = await getApiClient();
      const res = await api.collections.create({ name: newName.trim() });
      if ("error" in res) throw new Error(res.error.message);
      const newCol: CollectionSummary = {
        ...res.data,
        recipeCount: 0,
        coverImageUrl: null,
      };
      setCollections((prev) => [newCol, ...prev]);
      // Immediately add the recipe to the new collection
      await api.collections.addRecipe(res.data.id, recipeId);
      setMemberIds((prev) => new Set([...prev, res.data.id]));
      setNewName("");
      setCreating(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setCreateSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Add to collection</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" aria-label="Close">✕</button>
        </div>

        {/* Body */}
        <div className="max-h-80 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <p className="py-4 text-center text-sm text-gray-400">Loading…</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : collections.length === 0 && !creating ? (
            <p className="py-2 text-center text-sm text-gray-400">No collections yet.</p>
          ) : (
            collections.map((col) => {
              const isMember = memberIds.has(col.id);
              const isPending = pendingId === col.id;
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => { void toggleCollection(col.id); }}
                  disabled={isPending}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:opacity-50 ${
                    isMember
                      ? "border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950"
                      : "border-gray-200 hover:border-orange-200 hover:bg-orange-50 dark:border-gray-700 dark:hover:border-orange-800 dark:hover:bg-orange-950"
                  }`}
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs font-bold ${
                    isMember ? "border-orange-500 bg-orange-500 text-white" : "border-gray-300 text-transparent dark:border-gray-600"
                  }`}>
                    ✓
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{col.name}</p>
                    <p className="text-xs text-gray-400">{col.recipeCount} {col.recipeCount === 1 ? "recipe" : "recipes"}</p>
                  </div>
                  {col.isPublic && (
                    <span className="shrink-0 rounded-full bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-600 dark:bg-green-950 dark:text-green-400">Public</span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* New collection inline form */}
        {creating ? (
          <form onSubmit={(e) => { void handleCreate(e); }} className="border-t border-gray-100 px-4 py-3 space-y-2 dark:border-gray-800">
            <input
              className="input text-sm"
              placeholder="Collection name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              required
            />
            {createError && <p className="text-xs text-red-600">{createError}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={createSaving || !newName.trim()} className="btn-primary text-sm disabled:opacity-50">
                {createSaving ? "Creating…" : "Create & add"}
              </button>
              <button type="button" onClick={() => { setCreating(false); setCreateError(null); }} className="btn-secondary text-sm">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="border-t border-gray-100 px-4 py-3 dark:border-gray-800">
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="w-full rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm font-medium text-gray-500 hover:border-orange-300 hover:text-orange-600 transition-colors dark:border-gray-700 dark:text-gray-400 dark:hover:border-orange-700 dark:hover:text-orange-400"
            >
              + New collection
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
