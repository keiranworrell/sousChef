"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FermentationBatch, FermentationStatus } from "@souschef/shared";
import { getApiClient } from "@/lib/api";

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

const STATUS_STYLES: Record<FermentationStatus, string> = {
  active: "bg-orange-50 text-orange-600 border-orange-200",
  complete: "bg-green-50 text-green-700 border-green-200",
  abandoned: "bg-gray-100 text-gray-500 border-gray-200",
};

export default function FermentationPage(): React.JSX.Element {
  const router = useRouter();
  const [batches, setBatches] = useState<FermentationBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [startedAt, setStartedAt] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [targetEndDate, setTargetEndDate] = useState("");
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load(): Promise<void> {
    try {
      const api = await getApiClient();
      const res = await api.fermentation.list();
      if ("error" in res) throw new Error(res.error.message);
      setBatches(res.data.batches);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load batches");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!name.trim()) { setCreateError("Name is required"); return; }
    setCreateError(null);
    setCreateSaving(true);
    try {
      const api = await getApiClient();
      const res = await api.fermentation.create({
        name: name.trim(),
        startedAt: new Date(startedAt).toISOString(),
        targetEndDate: targetEndDate ? new Date(targetEndDate).toISOString() : null,
      });
      if ("error" in res) throw new Error(res.error.message);
      router.push(`/fermentation/${res.data.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create batch");
      setCreateSaving(false);
    }
  }

  async function handleDelete(id: string, batchName: string): Promise<void> {
    if (!confirm(`Delete "${batchName}"? All logs will be lost.`)) return;
    setDeletingId(id);
    try {
      const api = await getApiClient();
      await api.fermentation.delete(id);
      setBatches((prev) => prev.filter((b) => b.id !== id));
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Fermentation</h1>
        {!creating && (
          <button className="btn-primary" onClick={() => setCreating(true)}>
            + New batch
          </button>
        )}
      </div>

      {creating && (
        <form
          onSubmit={(e) => { void handleCreate(e); }}
          className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h2 className="mb-4 text-sm font-semibold text-gray-700">New batch</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <label className="label">Name *</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sourdough starter, Kimchi #3"
                autoFocus
              />
            </div>
            <div>
              <label className="label">Started</label>
              <input
                className="input"
                type="date"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Target end date</label>
              <input
                className="input"
                type="date"
                value={targetEndDate}
                onChange={(e) => setTargetEndDate(e.target.value)}
              />
            </div>
          </div>
          {createError && <p className="mt-2 text-sm text-red-600">{createError}</p>}
          <div className="mt-4 flex gap-2">
            <button type="submit" className="btn-primary" disabled={createSaving}>
              {createSaving ? "Creating…" : "Start batch"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => { setCreating(false); setCreateError(null); }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading && <p className="text-sm text-gray-400">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && batches.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-500">No batches yet.</p>
          <button className="mt-4 btn-primary" onClick={() => setCreating(true)}>
            Start your first batch
          </button>
        </div>
      )}

      <ul className="space-y-2">
        {batches.map((batch) => {
          const days = daysAgo(batch.startedAt);
          return (
            <li
              key={batch.id}
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
            >
              <Link
                href={`/fermentation/${batch.id}`}
                className="flex-1 min-w-0"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900 hover:text-orange-600 transition-colors">
                    {batch.name}
                  </span>
                  <span
                    className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLES[batch.status]}`}
                  >
                    {batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-gray-400">
                  Day {days}
                  {batch.targetEndDate && (
                    <> · target {new Date(batch.targetEndDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</>
                  )}
                </p>
              </Link>
              <button
                className="btn-secondary text-xs py-1 text-red-600 border-red-200 hover:bg-red-50 shrink-0 disabled:opacity-50"
                onClick={() => { void handleDelete(batch.id, batch.name); }}
                disabled={deletingId === batch.id}
              >
                {deletingId === batch.id ? "…" : "Delete"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
