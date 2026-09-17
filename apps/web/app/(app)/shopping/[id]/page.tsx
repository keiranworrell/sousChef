"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { ShoppingListItem, ShoppingListWithItems } from "@souschef/shared";
import { getApiClient } from "@/lib/api";
import { errorMessage, useToast } from "@/components/ToastProvider";
import { unwrap } from "@souschef/shared";

type AddForm = { name: string; quantity: string; unit: string; category: string };
const emptyAddForm: AddForm = { name: "", quantity: "", unit: "", category: "" };

export default function ShoppingListPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { showError } = useToast();
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

  // Merging. Off by default and explicitly entered, because the normal thing to
  // do on this screen is tick items off — turning every row into a selection
  // target by default would make the common action the awkward one.
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mergeName, setMergeName] = useState("");
  const [merging, setMerging] = useState(false);

  const selectedItems = (list?.items ?? []).filter((i) => selectedIds.includes(i.id));

  function exitMergeMode(): void {
    setMergeMode(false);
    setSelectedIds([]);
    setMergeName("");
  }

  function toggleSelected(item: ShoppingListItem): void {
    setSelectedIds((prev) => {
      const next = prev.includes(item.id)
        ? prev.filter((x) => x !== item.id)
        : [...prev, item.id];

      // Default the surviving name to the first thing picked, while leaving it
      // editable. Without a default the merge button is disabled until they
      // notice the field, which reads like the feature is broken.
      setMergeName((current) => {
        if (next.length === 0) return "";
        if (prev.length === 0) return item.name;
        return current;
      });

      return next;
    });
  }

  async function handleMerge(): Promise<void> {
    if (selectedIds.length < 2 || !mergeName.trim()) return;
    setMerging(true);
    setActionError(null);
    try {
      const api = await getApiClient();
      const res = await api.shopping.items.merge(id, selectedIds, mergeName.trim());
      if ("error" in res) throw new Error(res.error.message);

      // Reload rather than patching local state. The merge deletes rows and
      // rewrites one, and reconstructing that here would be a second
      // implementation of the server's rules, free to disagree with it.
      await load();
      exitMergeMode();
    } catch (err) {
      setActionError(errorMessage(err, "Could not merge those items"));
      showError(errorMessage(err, "Could not merge those items"));
    } finally {
      setMerging(false);
    }
  }

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
    } catch (err) {
      // Was silent. Ticking something off in a shop and having the tick not
      // register is how you get home without the thing.
      showError(errorMessage(err, "Couldn't update that item."));
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(itemId: string): Promise<void> {
    setDeletingId(itemId);
    try {
      const api = await getApiClient();
      unwrap(await api.shopping.items.delete(id, itemId));
      setList((prev) =>
        prev ? { ...prev, items: prev.items.filter((i) => i.id !== itemId) } : prev,
      );
    } catch (err) {
      showError(errorMessage(err, "Couldn't remove that item."));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleComplete(): Promise<void> {
    const checkedCount = list?.items.filter((i) => i.isChecked).length ?? 0;
    if (!confirm(`Mark this list complete? It will be deleted, including ${checkedCount} checked item${checkedCount !== 1 ? "s" : ""}.`)) return;
    setActionError(null);
    setCompleting(true);
    try {
      const api = await getApiClient();
      const res = await api.shopping.complete(id);
      if ("error" in res) throw new Error(res.error.message);
      router.push("/shopping");
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
      unwrap(await api.shopping.delete(id));
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
              {completing ? "Completing…" : "Complete list"}
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
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button className="btn-primary" onClick={() => setAdding(true)}>
            + Add item
          </button>
          {/* Only offered when there is something to merge. On a list of one,
              the button is an invitation to a dead end. */}
          {list.items.length > 1 && !mergeMode && (
            <button
              className="text-sm font-medium text-gray-500 hover:text-orange-600 dark:text-gray-400"
              onClick={() => setMergeMode(true)}
            >
              Merge duplicates
            </button>
          )}
        </div>
      )}

      {mergeMode && (
        <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50/60 p-4 dark:border-orange-900/60 dark:bg-orange-950/20">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Merge duplicates
          </p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Pick the items that are really the same thing. Their quantities are added
            together.
          </p>

          {selectedItems.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-xs font-medium text-gray-600 dark:text-gray-400">
                Keep this name
              </p>
              {/* The selected names as one-tap options, over a field they can
                  edit. Choosing between what is already there covers most of
                  it; the field is for when neither name is the right one. */}
              <div className="mb-2 flex flex-wrap gap-1.5">
                {selectedItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMergeName(item.name)}
                    className={
                      mergeName === item.name
                        ? "rounded-full bg-orange-500 px-3 py-1 text-xs font-medium text-white"
                        : "rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:border-orange-400 dark:border-gray-700 dark:text-gray-400"
                    }
                  >
                    {item.name}
                  </button>
                ))}
              </div>
              <input
                className="input w-full text-sm"
                value={mergeName}
                onChange={(e) => setMergeName(e.target.value)}
                maxLength={255}
                aria-label="Name for the merged item"
              />
            </div>
          )}

          <div className="mt-3 flex items-center gap-3">
            <button
              className="btn-primary text-sm disabled:opacity-50"
              onClick={() => { void handleMerge(); }}
              disabled={merging || selectedIds.length < 2 || !mergeName.trim()}
            >
              {merging
                ? "Merging…"
                : `Merge ${selectedIds.length > 1 ? `${selectedIds.length} items` : "items"}`}
            </button>
            <button
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400"
              onClick={exitMergeMode}
              disabled={merging}
            >
              Cancel
            </button>
            {selectedIds.length === 1 && (
              <span className="text-xs text-gray-400">Pick at least one more</span>
            )}
          </div>
        </div>
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
              mergeMode={mergeMode}
              selected={selectedIds.includes(item.id)}
              onSelect={toggleSelected}
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
                mergeMode={mergeMode}
                selected={selectedIds.includes(item.id)}
                onSelect={toggleSelected}
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
  mergeMode,
  selected,
  onSelect,
}: {
  item: ShoppingListItem;
  onToggle: (item: ShoppingListItem) => void;
  onDelete: (id: string) => void;
  toggling: boolean;
  deleting: boolean;
  mergeMode: boolean;
  selected: boolean;
  onSelect: (item: ShoppingListItem) => void;
}): React.JSX.Element {
  // In merge mode the whole row selects, and the checkbox and remove button
  // step aside. Leaving them live would put "tick off", "select for merge" and
  // "delete" within a few pixels of each other, and two of those are hard to
  // undo in a shop.
  if (mergeMode) {
    return (
      <li>
        <button
          type="button"
          onClick={() => onSelect(item)}
          aria-pressed={selected}
          className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left shadow-sm transition-colors ${
            selected
              ? "border-orange-400 bg-orange-50 dark:border-orange-600 dark:bg-orange-950/40"
              : "border-gray-200 bg-white hover:border-orange-300 dark:border-gray-800 dark:bg-gray-900"
          }`}
        >
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
              selected
                ? "border-orange-500 bg-orange-500"
                : "border-gray-300 dark:border-gray-600"
            }`}
          >
            {selected && (
              <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.name}</span>
            {item.quantity != null && (
              <span className="ml-2 text-xs text-gray-400">
                {item.quantity}
                {item.unit ? ` ${item.unit}` : ""}
              </span>
            )}
          </span>
        </button>
      </li>
    );
  }

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
