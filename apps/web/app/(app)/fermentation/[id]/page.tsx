"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type {
  FermentationBatchWithLogs,
  FermentationLog,
  FermentationStatus,
} from "@souschef/shared";
import { getApiClient } from "@/lib/api";

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

const STATUS_STYLES: Record<FermentationStatus, string> = {
  active: "bg-orange-50 text-orange-600 border-orange-200",
  complete: "bg-green-50 text-green-700 border-green-200",
  abandoned: "bg-gray-100 text-gray-500 border-gray-200",
};

type LogForm = {
  ph: string; saltPercent: string; temperatureCelsius: string;
  weightGrams: string; notes: string;
};
const emptyLogForm: LogForm = { ph: "", saltPercent: "", temperatureCelsius: "", weightGrams: "", notes: "" };

export default function BatchDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const [batch, setBatch] = useState<FermentationBatchWithLogs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addingLog, setAddingLog] = useState(false);
  const [logForm, setLogForm] = useState<LogForm>(emptyLogForm);
  const [logSaving, setLogSaving] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [id]);

  async function load(): Promise<void> {
    try {
      const api = await getApiClient();
      const res = await api.fermentation.get(id);
      if ("error" in res) throw new Error(res.error.message);
      setBatch(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load batch");
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(status: FermentationStatus): Promise<void> {
    if (!batch) return;
    setUpdatingStatus(true);
    try {
      const api = await getApiClient();
      const res = await api.fermentation.update(batch.id, { status });
      if ("error" in res) throw new Error(res.error.message);
      setBatch((prev) => prev ? { ...prev, status: res.data.status } : prev);
    } catch {
      // ignore
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleAddLog(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!batch) return;
    const hasData = logForm.ph || logForm.saltPercent || logForm.temperatureCelsius || logForm.weightGrams || logForm.notes.trim();
    if (!hasData) { setLogError("Add at least one measurement or note"); return; }
    setLogError(null);
    setLogSaving(true);
    try {
      const api = await getApiClient();
      const res = await api.fermentation.logs.create(batch.id, {
        ph: logForm.ph ? parseFloat(logForm.ph) : null,
        saltPercent: logForm.saltPercent ? parseFloat(logForm.saltPercent) : null,
        temperatureCelsius: logForm.temperatureCelsius ? parseFloat(logForm.temperatureCelsius) : null,
        weightGrams: logForm.weightGrams ? parseFloat(logForm.weightGrams) : null,
        notes: logForm.notes.trim() || null,
      });
      if ("error" in res) throw new Error(res.error.message);
      setBatch((prev) => prev ? { ...prev, logs: [...prev.logs, res.data] } : prev);
      setLogForm(emptyLogForm);
      setAddingLog(false);
    } catch (err) {
      setLogError(err instanceof Error ? err.message : "Failed to save log");
    } finally {
      setLogSaving(false);
    }
  }

  async function handleDeleteLog(log: FermentationLog): Promise<void> {
    if (!batch) return;
    setDeletingLogId(log.id);
    try {
      const api = await getApiClient();
      await api.fermentation.logs.delete(batch.id, log.id);
      setBatch((prev) => prev ? { ...prev, logs: prev.logs.filter((l) => l.id !== log.id) } : prev);
    } catch {
      // ignore
    } finally {
      setDeletingLogId(null);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-10"><p className="text-sm text-gray-400">Loading…</p></div>;
  }

  if (error || !batch) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-red-600">{error ?? "Batch not found"}</p>
        <Link href="/fermentation" className="mt-4 inline-block text-sm text-orange-500 hover:underline">← Fermentation</Link>
      </div>
    );
  }

  const days = daysAgo(batch.startedAt);
  const remaining = batch.targetEndDate ? daysUntil(batch.targetEndDate) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {/* Header */}
      <Link href="/fermentation" className="text-sm text-orange-500 hover:underline">← Fermentation</Link>
      <div className="mt-3 flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">{batch.name}</h1>
        <span className={`inline-flex text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_STYLES[batch.status]}`}>
          {batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-400">
        Day {days}
        {remaining !== null
          ? remaining >= 0
            ? ` · ${remaining} days remaining`
            : ` · ${Math.abs(remaining)} days past target`
          : ""}
        {batch.targetEndDate && (
          <> · target {new Date(batch.targetEndDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</>
        )}
      </p>

      {/* Status controls */}
      <div className="mt-4 flex gap-2 flex-wrap">
        {batch.status === "active" && (
          <>
            <button
              className="btn-secondary text-sm text-green-700 border-green-200 hover:bg-green-50 disabled:opacity-50"
              onClick={() => { void handleStatusChange("complete"); }}
              disabled={updatingStatus}
            >
              Mark complete
            </button>
            <button
              className="btn-secondary text-sm text-gray-500 disabled:opacity-50"
              onClick={() => { void handleStatusChange("abandoned"); }}
              disabled={updatingStatus}
            >
              Abandon
            </button>
          </>
        )}
        {(batch.status === "complete" || batch.status === "abandoned") && (
          <button
            className="btn-secondary text-sm text-orange-600 border-orange-200 hover:bg-orange-50 disabled:opacity-50"
            onClick={() => { void handleStatusChange("active"); }}
            disabled={updatingStatus}
          >
            Reactivate
          </button>
        )}
      </div>

      {/* Log section */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Log entries</h2>
          {!addingLog && (
            <button className="btn-primary text-sm" onClick={() => setAddingLog(true)}>
              + Add entry
            </button>
          )}
        </div>

        {addingLog && (
          <form
            onSubmit={(e) => { void handleAddLog(e); }}
            className="mb-6 rounded-xl border border-orange-100 bg-white p-4 shadow-sm"
          >
            <p className="mb-3 text-sm font-medium text-gray-600">Fill in any measurements taken today:</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="label">pH</label>
                <input className="input" type="number" min="0" max="14" step="0.1" value={logForm.ph} onChange={(e) => setLogForm((p) => ({ ...p, ph: e.target.value }))} placeholder="3.5" />
              </div>
              <div>
                <label className="label">Salt %</label>
                <input className="input" type="number" min="0" max="100" step="0.1" value={logForm.saltPercent} onChange={(e) => setLogForm((p) => ({ ...p, saltPercent: e.target.value }))} placeholder="2.0" />
              </div>
              <div>
                <label className="label">Temp (°C)</label>
                <input className="input" type="number" min="-20" max="100" step="0.1" value={logForm.temperatureCelsius} onChange={(e) => setLogForm((p) => ({ ...p, temperatureCelsius: e.target.value }))} placeholder="21" />
              </div>
              <div>
                <label className="label">Weight (g)</label>
                <input className="input" type="number" min="0" step="1" value={logForm.weightGrams} onChange={(e) => setLogForm((p) => ({ ...p, weightGrams: e.target.value }))} placeholder="450" />
              </div>
              <div className="col-span-2 sm:col-span-4">
                <label className="label">Notes</label>
                <textarea className="input resize-none" rows={2} value={logForm.notes} onChange={(e) => setLogForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Observations, smell, texture, activity…" />
              </div>
            </div>
            {logError && <p className="mt-2 text-sm text-red-600">{logError}</p>}
            <div className="mt-3 flex gap-2">
              <button type="submit" className="btn-primary" disabled={logSaving}>
                {logSaving ? "Saving…" : "Save entry"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => { setAddingLog(false); setLogForm(emptyLogForm); setLogError(null); }}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {batch.logs.length === 0 && (
          <p className="text-sm text-gray-400 italic">No entries yet. Start logging to track your batch over time.</p>
        )}

        <ul className="space-y-3">
          {[...batch.logs].reverse().map((log, i) => (
            <li
              key={log.id}
              className={`rounded-xl border bg-white p-4 shadow-sm ${i === 0 ? "border-orange-200" : "border-gray-200"}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">
                  {new Date(log.loggedAt).toLocaleDateString("en-GB", {
                    weekday: "short", day: "numeric", month: "short", year: "numeric",
                  })}
                </span>
                <button
                  className="text-xs text-gray-300 hover:text-red-400 transition-colors disabled:opacity-50"
                  onClick={() => { void handleDeleteLog(log); }}
                  disabled={deletingLogId === log.id}
                >
                  {deletingLogId === log.id ? "…" : "Remove"}
                </button>
              </div>
              <div className="flex flex-wrap gap-3 mb-2">
                {log.ph != null && <Stat label="pH" value={String(log.ph)} />}
                {log.saltPercent != null && <Stat label="Salt" value={`${log.saltPercent}%`} />}
                {log.temperatureCelsius != null && <Stat label="Temp" value={`${log.temperatureCelsius}°C`} />}
                {log.weightGrams != null && <Stat label="Weight" value={`${log.weightGrams}g`} />}
              </div>
              {log.notes && <p className="text-sm text-gray-600">{log.notes}</p>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-sm font-bold text-gray-900">{value}</p>
    </div>
  );
}
