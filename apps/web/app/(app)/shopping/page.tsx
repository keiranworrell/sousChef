"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ShoppingList } from "@souschef/shared";
import { getApiClient } from "@/lib/api";

export default function ShoppingPage(): React.JSX.Element {
  const router = useRouter();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load(): Promise<void> {
    try {
      const api = await getApiClient();
      const res = await api.shopping.list();
      if ("error" in res) throw new Error(res.error.message);
      setLists(res.data.lists);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load shopping lists");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const name = newName.trim();
    if (!name) { setCreateError("Name is required"); return; }
    setCreateError(null);
    setCreateSaving(true);
    try {
      const api = await getApiClient();
      const res = await api.shopping.create({ name });
      if ("error" in res) throw new Error(res.error.message);
      router.push(`/shopping/${res.data.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create list");
      setCreateSaving(false);
    }
  }

  async function handleDelete(id: string, name: string): Promise<void> {
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
    setDeletingId(id);
    try {
      const api = await getApiClient();
      await api.shopping.delete(id);
      setLists((prev) => prev.filter((l) => l.id !== id));
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Shopping lists</h1>
        {!creating && (
          <button className="btn-primary" onClick={() => setCreating(true)}>
            + New list
          </button>
        )}
      </div>

      {creating && (
        <form
          onSubmit={(e) => { void handleCreate(e); }}
          className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
        >
          <label className="label">List name</label>
          <input
            className="input mb-3"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Weekly shop"
            autoFocus
          />
          {createError && <p className="mb-2 text-sm text-red-600">{createError}</p>}
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={createSaving}>
              {createSaving ? "Creating…" : "Create list"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => { setCreating(false); setNewName(""); setCreateError(null); }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading && <p className="text-sm text-gray-400">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && lists.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-500">No shopping lists yet.</p>
          <button className="mt-4 btn-primary" onClick={() => setCreating(true)}>
            Create your first list
          </button>
        </div>
      )}

      <ul className="space-y-2">
        {lists.map((list) => (
          <li
            key={list.id}
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
          >
            <Link
              href={`/shopping/${list.id}`}
              className="flex-1 font-medium text-gray-900 hover:text-orange-600 transition-colors"
            >
              {list.name}
            </Link>
            <button
              className="btn-secondary text-xs py-1 text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-50"
              onClick={() => { void handleDelete(list.id, list.name); }}
              disabled={deletingId === list.id}
            >
              {deletingId === list.id ? "…" : "Delete"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
