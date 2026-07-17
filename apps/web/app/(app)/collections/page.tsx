"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CollectionSummary } from "@souschef/shared";
import { getApiClient } from "@/lib/api";

export default function CollectionsPage(): React.JSX.Element {
  const router = useRouter();
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPublic, setNewPublic] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load(): Promise<void> {
    try {
      const api = await getApiClient();
      const res = await api.collections.list();
      if ("error" in res) throw new Error(res.error.message);
      setCollections(res.data.collections);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load collections");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreateError(null);
    setCreateSaving(true);
    try {
      const api = await getApiClient();
      const res = await api.collections.create({
        name: newName.trim(),
        description: newDescription.trim() || null,
        isPublic: newPublic,
      });
      if ("error" in res) throw new Error(res.error.message);
      router.push(`/collections/${res.data.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create collection");
      setCreateSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Collections</h1>
        {!creating && (
          <button className="btn-primary" onClick={() => setCreating(true)}>
            + New collection
          </button>
        )}
      </div>

      {/* Create form */}
      {creating && (
        <form
          onSubmit={(e) => { void handleCreate(e); }}
          className="mb-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm space-y-3"
        >
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">New collection</h2>
          <div>
            <label className="label">Name *</label>
            <input
              className="input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Weeknight dinners"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input min-h-[60px] resize-y"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={newPublic}
              onChange={(e) => setNewPublic(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 accent-orange-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Make public
              <span className="ml-1 text-xs text-gray-400">(all recipes in this collection will also be made public)</span>
            </span>
          </label>
          {createError && <p className="text-xs text-red-600">{createError}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={createSaving || !newName.trim()} className="btn-primary disabled:opacity-50">
              {createSaving ? "Creating…" : "Create"}
            </button>
            <button type="button" onClick={() => { setCreating(false); setCreateError(null); }} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {collections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 py-16 text-center">
          <p className="text-sm text-gray-400">No collections yet.</p>
          <p className="mt-1 text-xs text-gray-300">Create a collection to organise your recipes into folders.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {collections.map((col) => (
            <Link
              key={col.id}
              href={`/collections/${col.id}`}
              className="group rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden hover:border-orange-200 hover:shadow-sm transition-all"
            >
              {/* Cover image */}
              <div className="h-32 bg-gray-100 dark:bg-gray-800 overflow-hidden">
                {col.coverImageUrl ? (
                  <img
                    src={col.coverImageUrl}
                    alt={col.name}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-3xl">📁</div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-gray-900 dark:text-gray-100">{col.name}</h2>
                    {col.description && (
                      <p className="mt-0.5 text-xs text-gray-400 line-clamp-2">{col.description}</p>
                    )}
                  </div>
                  {col.isPublic && (
                    <span className="shrink-0 rounded-full bg-green-50 dark:bg-green-950 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                      Public
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-gray-400">
                  {col.recipeCount} {col.recipeCount === 1 ? "recipe" : "recipes"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
