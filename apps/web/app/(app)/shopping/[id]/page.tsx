"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { ShoppingListItem, ShoppingListWithItems } from "@souschef/shared";
import { getApiClient } from "@/lib/api";

type AddForm = { name: string; quantity: string; unit: string; category: string };
const emptyAddForm: AddForm = { name: "", quantity: "", unit: "", category: "" };

export default function ShoppingListPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [list, setList] = useState<ShoppingListWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // List-level actions
  const [completing, setCompleting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Add item form
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>(emptyAddForm);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Toggling checked
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Deleting
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [id]);

  async function load(): Promise<void> {
    try {
      const api = await getApiClient();
      const res = await api.shopping.get(id);
      if ("error" in res) throw new Error(res.error.message);
      setList(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load list");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddItem(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const name = addForm.name.trim();
    if (!name) { setAddError("Name is required"); return; }
    setAddError(null);
    setAddSaving(true);
    try {
      const api = await getApiClient();
      const res = await api.shopping.items.create(id, {
        name,
        quantity: addForm.quantity ? parseFloat(addForm.quantity) : null,
        unit: addForm.unit.trim() || null,
        category: addForm.category.trim() || null,
      });
      if ("error" in res) throw new Error(res.error.message);
      setList((prev) => prev ? { ...prev, items: [...prev.items, res.data] } : prev);
      setAddForm(emptyAddForm);
      setAdding(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add item");
    } finally {
      setAddSaving(false);
    }
  }

  async function handleToggle(item: ShoppingListItem): Promise<void> {
    setTogglingId(item.id);
    try {
      const api = await getApiClient();
      const res = await api.shopping.items.update(id, item.id, { isChecked: !item.isChecked });
      if ("error" in res) throw new Error(res.error.message);
      setList((prev) =>
        prev ? { ...prev, items: prev.items.map((i) => (i.id === item.id ? res.data : i)) } : prev,
      );
    } catch {
      // ignore
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(itemId: string): Promise<void> {
    setDeletingId(itemId);
    try {
      const api = await getApiClient();
      await api.shopping.items.delete(id, itemId);
      setList((prev) =>
        prev ? { ...prev, items: prev.items.filter((i) => i.id !== itemId) } : prev,
      );
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  }

  async function handleComplete(): Promise<void> {
    const checkedCount = list?.items.filter((i) => i.isChecked).length ?? 0;
    if (!confirm(`Add ${checkedCount} checked item${checkedCount !== 1 ? "s" : ""} to your pantry and delete this list?`)) return;
    setActionError(null);
    setCompleting(true);
    try {
      const api = await getApiClient();
      const res = await api.shopping.complete(id);
      if ("error" in res) throw new Error(res.error.message);
      router.push("/pantry");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCompleting(false);
    }
  }

  async function handleDeleteList(): Promise<void> {
    if (!confirm(`Delete "${list?.name}"? This can't be undone.`)) return;
    setActionError(null);
    setDeleting(true);
    try {
      const api = await getApiClient();
      await api.shopping.delete(id);
      router.push("/shopping");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-10"><p className="text-sm text-gray-400">Loading…</p></div>;
  }

  if (error || !list) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-red-600">{error ?? "List not found"}</p>
        <Link href="/shopping" className="mt-4 inline-block text-sm text-orange-500 hover:underline">← Shopping lists</Link>
      </div>
    );
  }

  const unchecked = list.items.filter((i) => !i.isChecked);
  const checked = list.items.filter((i) => i.isChecked);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6">
        <Link href="/shopping" className="text-sm text-orange-500 hover:underline">← Shopping lists</Link>
        <div className="mt-2 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{list.name}</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {unchecked.length} remaining · {checked.length} checked
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              className="btn-primary py-1.5 px-3 text-sm disabled:opacity-50"
              onClick={() => { void handleComplete(); }}
              disabled={completing || deleting}
            >
              {completing ? "Updating pantry…" : "Complete & update pantry"}
            </button>
            <button
              className="btn-secondary py-1.5 px-3 text-sm text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-50"
              onClick={() => { void handleDeleteList(); }}
              disabled={completing || deleting}
            >
              {deleting ? "Deleting…" : "Delete list"}
            </button>
          </div>
        </div>
        {actionError && <p className="mt-2 text-sm text-red-600">{actionError}</p>}
      </div>

      {/* Add item form */}
      {adding ? (
        <form
          onSubmit={(e) => { void handleAddItem(e); }}
          className="mb-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm"
        >
          <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Add item</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="col-span-2">
              <label className="label">Name *</label>
              <input
                className="input"
                value={addForm.name}
                onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Bread flour"
                autoFocus
              />
            </div>
            <div>
              <label className="label">Qty</label>
              <input
                className="input"
                type="number"
                min="0"
                step="any"
                value={addForm.quantity}
                onChange={(e) => setAddForm((p) => ({ ...p, quantity: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div>
              <label className="label">Unit</label>
              <input
                className="input"
                value={addForm.unit}
                onChange={(e) => setAddForm((p) => ({ ...p, unit: e.target.value }))}
                placeholder="kg, ml…"
              />
            </div>
            <div className="col-span-2 sm:col-span-4">
              <label className="label">Category</label>
              <input
                className="input"
                value={addForm.category}
                onChange={(e) => setAddForm((p) => ({ ...p, category: e.target.value }))}
                placeholder="e.g. Bakery, Dairy…"
              />
            </div>
          </div>
          {addError && <p className="mt-2 text-sm text-red-600">{addError}</p>}
          <div className="mt-3 flex gap-2">
            <button type="submit" className="btn-primary" disabled={addSaving}>
              {addSaving ? "Adding…" : "Add item"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => { setAdding(false); setAddForm(emptyAddForm); setAddError(null); }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button className="btn-primary mb-6" onClick={() => setAdding(true)}>
          + Add item
        </button>
      )}

      {list.items.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-10 text-center">
          <p className="text-gray-500 dark:text-gray-400">No items yet. Add something above.</p>
        </div>
      )}

      {/* Unchecked items */}
      {unchecked.length > 0 && (
        <ul className="space-y-1.5 mb-6">
          {unchecked.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onToggle={handleToggle}
              onDelete={handleDelete}
              toggling={togglingId === item.id}
              deleting={deletingId === item.id}
            />
          ))}
        </ul>
      )}

      {/* Checked items */}
      {checked.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Done ({checked.length})
          </p>
          <ul className="space-y-1.5 opacity-60">
            {checked.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                onToggle={handleToggle}
                onDelete={handleDelete}
                toggling={togglingId === item.id}
                deleting={deletingId === item.id}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ItemRow({
  item,
  onToggle,
  onDelete,
  toggling,
  deleting,
}: {
  item: ShoppingListItem;
  onToggle: (item: ShoppingListItem) => void;
  onDelete: (id: string) => void;
  toggling: boolean;
  deleting: boolean;
}): React.JSX.Element {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2.5 shadow-sm">
      <button
        onClick={() => onToggle(item)}
        disabled={toggling}
        className={`shrink-0 h-5 w-5 rounded border-2 transition-colors flex items-center justify-center ${
          item.isChecked
            ? "bg-orange-500 border-orange-500"
            : "border-gray-300 dark:border-gray-600 hover:border-orange-400"
        } disabled:opacity-50`}
        aria-label={item.isChecked ? "Uncheck" : "Check"}
      >
        {item.isChecked && (
          <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <span className={`text-sm font-medium ${item.isChecked ? "line-through text-gray-400" : "text-gray-900 dark:text-gray-100"}`}>
          {item.name}
        </span>
        {(item.quantity != null || item.category) && (
          <span className="ml-2 text-xs text-gray-400">
            {item.quantity != null && `${item.quantity}${item.unit ? ` ${item.unit}` : ""}`}
            {item.quantity != null && item.category && " · "}
            {item.category}
          </span>
        )}
      </div>

      <button
        onClick={() => onDelete(item.id)}
        disabled={deleting}
        className="shrink-0 text-gray-300 hover:text-red-400 transition-colors disabled:opacity-50"
        aria-label="Remove"
      >
        <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </li>
  );
}
