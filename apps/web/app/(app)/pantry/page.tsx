"use client";

import React, { useEffect, useState } from "react";
import type { PantryItem, CreatePantryItemInput, UpdatePantryItemInput } from "@souschef/shared";
import { getApiClient } from "@/lib/api";

type FormState = {
  name: string;
  quantity: string;
  unit: string;
  expiryDate: string;
  lowStockThreshold: string;
};

const emptyForm: FormState = {
  name: "",
  quantity: "",
  unit: "",
  expiryDate: "",
  lowStockThreshold: "",
};

function expiryStatus(expiryDate: string | null): "expired" | "soon" | "ok" | null {
  if (!expiryDate) return null;
  const days = Math.ceil(
    (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  if (days < 0) return "expired";
  if (days <= 3) return "soon";
  return "ok";
}

function ExpiryBadge({ expiryDate }: { expiryDate: string | null }): React.JSX.Element | null {
  const status = expiryStatus(expiryDate);
  if (!status || status === "ok") return null;
  const label =
    status === "expired"
      ? "Expired"
      : `Expires ${new Date(expiryDate!).toLocaleDateString()}`;
  const cls =
    status === "expired"
      ? "text-red-600 bg-red-50 border-red-200"
      : "text-orange-600 bg-orange-50 border-orange-200";
  return (
    <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  );
}

export default function PantryPage(): React.JSX.Element {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add form
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState<FormState>(emptyForm);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load(): Promise<void> {
    try {
      const api = await getApiClient();
      const res = await api.pantry.list();
      if ("error" in res) throw new Error(res.error.message);
      setItems(res.data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pantry");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!addForm.name.trim()) { setAddError("Name is required"); return; }
    setAddError(null);
    setAddSaving(true);
    try {
      const api = await getApiClient();
      const input: CreatePantryItemInput = {
        name: addForm.name.trim(),
        quantity: addForm.quantity ? parseFloat(addForm.quantity) : null,
        unit: addForm.unit.trim() || null,
        expiryDate: addForm.expiryDate || null,
        lowStockThreshold: addForm.lowStockThreshold ? parseFloat(addForm.lowStockThreshold) : null,
      };
      const res = await api.pantry.create(input);
      if ("error" in res) throw new Error(res.error.message);
      setItems((prev) => [res.data, ...prev]);
      setAddForm(emptyForm);
      setAdding(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add item");
    } finally {
      setAddSaving(false);
    }
  }

  function startEdit(item: PantryItem): void {
    setEditingId(item.id);
    setEditError(null);
    setEditForm({
      name: item.name,
      quantity: item.quantity != null ? String(item.quantity) : "",
      unit: item.unit ?? "",
      expiryDate: item.expiryDate ? item.expiryDate.slice(0, 10) : "",
      lowStockThreshold: item.lowStockThreshold != null ? String(item.lowStockThreshold) : "",
    });
  }

  async function handleEdit(e: React.FormEvent, id: string): Promise<void> {
    e.preventDefault();
    if (!editForm.name.trim()) { setEditError("Name is required"); return; }
    setEditError(null);
    setEditSaving(true);
    try {
      const api = await getApiClient();
      const input: UpdatePantryItemInput = {
        name: editForm.name.trim(),
        quantity: editForm.quantity ? parseFloat(editForm.quantity) : null,
        unit: editForm.unit.trim() || null,
        expiryDate: editForm.expiryDate || null,
        lowStockThreshold: editForm.lowStockThreshold ? parseFloat(editForm.lowStockThreshold) : null,
      };
      const res = await api.pantry.update(id, input);
      if ("error" in res) throw new Error(res.error.message);
      setItems((prev) => prev.map((i) => (i.id === id ? res.data : i)));
      setEditingId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update item");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    if (!confirm("Remove this item from your pantry?")) return;
    setDeletingId(id);
    try {
      const api = await getApiClient();
      await api.pantry.delete(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      // silently ignore — item stays in list
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pantry</h1>
        {!adding && (
          <button className="btn-primary" onClick={() => setAdding(true)}>
            + Add item
          </button>
        )}
      </div>

      {/* Add form */}
      {adding && (
        <form
          onSubmit={(e) => { void handleAdd(e); }}
          className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
        >
          <h2 className="mb-3 text-sm font-semibold text-gray-700">New item</h2>
          <ItemFields form={addForm} setForm={setAddForm} />
          {addError && <p className="mt-2 text-sm text-red-600">{addError}</p>}
          <div className="mt-3 flex gap-2">
            <button type="submit" className="btn-primary" disabled={addSaving}>
              {addSaving ? "Adding…" : "Add item"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => { setAdding(false); setAddForm(emptyForm); setAddError(null); }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading && <p className="text-sm text-gray-400">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-500">Your pantry is empty.</p>
          <button
            className="mt-4 btn-primary"
            onClick={() => setAdding(true)}
          >
            Add your first item
          </button>
        </div>
      )}

      <ul className="space-y-2">
        {items.map((item) =>
          editingId === item.id ? (
            <li key={item.id} className="rounded-xl border border-orange-200 bg-white p-4 shadow-sm">
              <form onSubmit={(e) => { void handleEdit(e, item.id); }}>
                <ItemFields form={editForm} setForm={setEditForm} />
                {editError && <p className="mt-2 text-sm text-red-600">{editError}</p>}
                <div className="mt-3 flex gap-2">
                  <button type="submit" className="btn-primary" disabled={editSaving}>
                    {editSaving ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => { setEditingId(null); setEditError(null); }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </li>
          ) : (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900">{item.name}</span>
                  {item.quantity != null && (
                    <span className="text-sm text-gray-500">
                      {item.quantity}{item.unit ? ` ${item.unit}` : ""}
                    </span>
                  )}
                  <ExpiryBadge expiryDate={item.expiryDate} />
                  {item.lowStockThreshold != null &&
                    item.quantity != null &&
                    item.quantity <= item.lowStockThreshold && (
                      <span className="inline-flex text-xs font-medium px-2 py-0.5 rounded-full border text-yellow-700 bg-yellow-50 border-yellow-200">
                        Low stock
                      </span>
                    )}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  className="btn-secondary text-xs py-1"
                  onClick={() => startEdit(item)}
                >
                  Edit
                </button>
                <button
                  className="btn-secondary text-xs py-1 text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-50"
                  onClick={() => { void handleDelete(item.id); }}
                  disabled={deletingId === item.id}
                >
                  {deletingId === item.id ? "…" : "Remove"}
                </button>
              </div>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

function ItemFields({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}): React.JSX.Element {
  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="col-span-2 sm:col-span-2">
        <label className="label">Name *</label>
        <input className="input" value={form.name} onChange={set("name")} placeholder="e.g. Sourdough starter" autoFocus />
      </div>
      <div>
        <label className="label">Quantity</label>
        <input className="input" type="number" min="0" step="any" value={form.quantity} onChange={set("quantity")} placeholder="0" />
      </div>
      <div>
        <label className="label">Unit</label>
        <input className="input" value={form.unit} onChange={set("unit")} placeholder="g, ml, bags…" />
      </div>
      <div className="col-span-2">
        <label className="label">Expiry date</label>
        <input className="input" type="date" value={form.expiryDate} onChange={set("expiryDate")} />
      </div>
      <div className="col-span-2">
        <label className="label">Low stock alert below</label>
        <input className="input" type="number" min="0" step="any" value={form.lowStockThreshold} onChange={set("lowStockThreshold")} placeholder="e.g. 100" />
      </div>
    </div>
  );
}
