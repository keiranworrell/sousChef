"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { CollectionWithItems, CollectionRecipeItem } from "@souschef/shared";
import { getApiClient } from "@/lib/api";

export default function CollectionDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [collection, setCollection] = useState<CollectionWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPublic, setEditPublic] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete
  const [deleting, setDeleting] = useState(false);

  // Remove recipe
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [id]);

  async function load(): Promise<void> {
    try {
      const api = await getApiClient();
      const res = await api.collections.get(id);
      if ("error" in res) throw new Error(res.error.message);
      setCollection(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load collection");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(): void {
    if (!collection) return;
    setEditName(collection.name);
    setEditDescription(collection.description ?? "");
    setEditPublic(collection.isPublic);
    setEditError(null);
    setEditing(true);
  }

  async function handleEdit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!collection) return;
    setEditError(null);
    setEditSaving(true);
    try {
      const api = await getApiClient();
      const res = await api.collections.update(id, {
        name: editName.trim(),
        description: editDescription.trim() || null,
        isPublic: editPublic,
      });
      if ("error" in res) throw new Error(res.error.message);
      setCollection((prev) =>
        prev
          ? {
              ...prev,
              name: res.data.name,
              description: res.data.description,
              isPublic: res.data.isPublic,
              // If made public, mark all items as public too (mirrors server behaviour)
              items: editPublic
                ? prev.items.map((i) => ({ ...i, isPublic: true }))
                : prev.items,
            }
          : prev,
      );
      setEditing(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!confirm("Delete this collection? Recipes will not be deleted.")) return;
    setDeleting(true);
    try {
      const api = await getApiClient();
      await api.collections.delete(id);
      router.push("/collections");
    } catch {
      setDeleting(false);
    }
  }

  async function handleRemoveRecipe(recipeId: string): Promise<void> {
    setRemovingId(recipeId);
    try {
      const api = await getApiClient();
      await api.collections.removeRecipe(id, recipeId);
      setCollection((prev) =>
        prev ? { ...prev, items: prev.items.filter((i) => i.recipeId !== recipeId), recipeCount: prev.recipeCount - 1 } : prev,
      );
    } finally {
      setRemovingId(null);
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
        <Link href="/collections" className="mt-4 inline-block text-sm text-orange-500 hover:underline">
          ← Collections
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/collections" className="text-sm text-orange-500 hover:underline">
        ← Collections
      </Link>

      {/* Header */}
      {editing ? (
        <form onSubmit={(e) => { void handleEdit(e); }} className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Edit collection</h2>
          <div>
            <label className="label">Name *</label>
            <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input min-h-[60px] resize-y" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={editPublic}
              onChange={(e) => setEditPublic(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 accent-orange-500"
            />
            <span className="text-sm text-gray-700">
              Public
              {!collection.isPublic && editPublic && (
                <span className="ml-1 text-xs text-orange-500">(all recipes will be made public)</span>
              )}
            </span>
          </label>
          {editError && <p className="text-xs text-red-600">{editError}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={editSaving || !editName.trim()} className="btn-primary disabled:opacity-50">
              {editSaving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      ) : (
        <div className="mt-4 mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 break-words">{collection.name}</h1>
              {collection.isPublic && (
                <span className="shrink-0 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-600">Public</span>
              )}
            </div>
            {collection.description && (
              <p className="mt-1 text-sm text-gray-500">{collection.description}</p>
            )}
            <p className="mt-2 text-xs text-gray-400">{collection.recipeCount} {collection.recipeCount === 1 ? "recipe" : "recipes"}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={startEdit} className="btn-secondary text-sm">Edit</button>
            <button
              onClick={() => { void handleDelete(); }}
              disabled={deleting}
              className="text-sm text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      )}

      {/* Recipe list */}
      {collection.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center">
          <p className="text-sm text-gray-400">No recipes yet.</p>
          <p className="mt-1 text-xs text-gray-300">Add recipes from any recipe page using the &ldquo;Add to collection&rdquo; button.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {collection.items.map((item: CollectionRecipeItem) => (
            <div
              key={item.recipeId}
              className="flex items-center gap-3 rounded-lg border border-gray-100 p-3"
            >
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.title} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="h-14 w-14 shrink-0 rounded-lg bg-gray-100 flex items-center justify-center text-xl">🍽️</div>
              )}
              <div className="min-w-0 flex-1">
                <Link
                  href={`/recipes/${item.recipeId}`}
                  className="truncate text-sm font-medium text-gray-900 hover:text-orange-600 transition-colors"
                >
                  {item.title}
                </Link>
                <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-gray-400">
                  {item.cookTimeMinutes && <span>{item.cookTimeMinutes} min</span>}
                  {item.difficulty && <span className="capitalize">{item.difficulty}</span>}
                  {item.cuisine && <span>{item.cuisine}</span>}
                  {item.isPublic && <span className="text-green-600">Public</span>}
                </div>
              </div>
              <button
                onClick={() => { void handleRemoveRecipe(item.recipeId); }}
                disabled={removingId === item.recipeId}
                className="shrink-0 text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                aria-label="Remove from collection"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
