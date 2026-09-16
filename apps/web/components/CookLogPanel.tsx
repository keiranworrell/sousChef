"use client";

import React, { useState } from "react";
import type { CookLogEntry, UpdateCookLogInput } from "@souschef/shared";
import { getApiClient } from "@/lib/api";

type Props = {
  recipeId: string;
  entries: CookLogEntry[];
  loading: boolean;
  error: string | null;
  onRemoved: (entryId: string) => void;
  onUpdated: (entry: CookLogEntry) => void;
};

export type CookLogDraft = {
  rating: number | null;
  /** yyyy-mm-dd, as an <input type="date"> gives it. */
  cookedAt: string;
  notes: string;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** The local calendar day of an ISO timestamp, for an <input type="date">. */
export function toDateInputValue(iso: string): string {
  const d = new Date(iso);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * The fields that actually changed, and only those.
 *
 * The endpoint distinguishes absent ("leave it") from null ("clear it"), which
 * is the whole reason it exists — sending the entire draft every time would
 * make editing the notes overwrite a rating with whatever the form happened to
 * be holding. So the diff is the contract, not an optimisation.
 *
 * `cookedAt` is compared by calendar day rather than by timestamp. The form
 * only offers a day, so a round trip through it would otherwise rewrite every
 * entry's time to midnight on save. Comparing days means the time survives
 * unless the user actually moved the entry to a different date.
 */
export function diffCookLogEdit(entry: CookLogEntry, draft: CookLogDraft): UpdateCookLogInput {
  const update: UpdateCookLogInput = {};

  if (draft.rating !== entry.rating) update.rating = draft.rating;

  const trimmed = draft.notes.trim();
  if (trimmed !== (entry.notes ?? "")) update.notes = trimmed ? trimmed : null;

  if (draft.cookedAt && draft.cookedAt !== toDateInputValue(entry.cookedAt)) {
    update.cookedAt = draft.cookedAt;
  }

  return update;
}

function Stars({ rating }: { rating: number }): React.JSX.Element {
  return (
    <span className="text-orange-400" aria-label={`${rating} out of 5`}>
      {"★".repeat(rating)}
      <span className="text-gray-200 dark:text-gray-700">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

function StarPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (rating: number | null) => void;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          // Clicking the current rating clears it. Without this there is no way
          // back to "cooked it, no opinion" once a star has been tapped.
          onClick={() => { onChange(value === n ? null : n); }}
          aria-label={value === n ? `Clear rating` : `Rate ${n} out of 5`}
          aria-pressed={value !== null && n <= value}
          className={
            value !== null && n <= value
              ? "text-xl leading-none text-orange-400"
              : "text-xl leading-none text-gray-200 hover:text-orange-200 dark:text-gray-700"
          }
        >
          ★
        </button>
      ))}
      {value !== null && (
        <button
          type="button"
          onClick={() => { onChange(null); }}
          className="ml-1 text-xs text-gray-400 underline hover:text-gray-600"
        >
          Clear
        </button>
      )}
    </div>
  );
}

/**
 * The user's own cooks of this recipe. Private — it renders on the app's recipe
 * page and never on the public or short-link views, because notes like "too
 * salty, halve the soy" are a private working note on someone else's recipe.
 */
export default function CookLogPanel({
  recipeId,
  entries,
  loading,
  error,
  onRemoved,
  onUpdated,
}: Props): React.JSX.Element | null {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CookLogDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function startEditing(entry: CookLogEntry): void {
    setEditingId(entry.id);
    setExpandedId(null);
    setActionError(null);
    setDraft({
      rating: entry.rating,
      cookedAt: toDateInputValue(entry.cookedAt),
      notes: entry.notes ?? "",
    });
  }

  function cancelEditing(): void {
    setEditingId(null);
    setDraft(null);
  }

  async function handleSave(entry: CookLogEntry): Promise<void> {
    if (!draft) return;
    const update = diffCookLogEdit(entry, draft);

    // Nothing changed. Closing the form is the honest response — sending an
    // empty patch would earn a 400 telling the user off for touching nothing.
    if (Object.keys(update).length === 0) {
      cancelEditing();
      return;
    }

    setSaving(true);
    setActionError(null);
    try {
      const api = await getApiClient();
      const res = await api.recipes.updateCookLogEntry(recipeId, entry.id, update);
      if ("error" in res) throw new Error(res.error.message);
      onUpdated(res.data);
      cancelEditing();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not save that change");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(entryId: string): Promise<void> {
    if (!confirm("Delete this cook log entry?")) return;
    setRemovingId(entryId);
    setActionError(null);
    try {
      const api = await getApiClient();
      const res = await api.recipes.deleteCookLogEntry(recipeId, entryId);
      if ("error" in res) throw new Error(res.error.message);
      onRemoved(entryId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not delete that entry");
    } finally {
      setRemovingId(null);
    }
  }

  // A failed load has to say so. Rendering nothing would be indistinguishable
  // from "you've never cooked this", which is a different and misleading claim.
  if (error) {
    return (
      <section className="mt-10 border-t border-gray-100 dark:border-gray-800 pt-6">
        <h2 className="mb-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Your cook log
        </h2>
        <p className="text-sm text-red-600">{error}</p>
      </section>
    );
  }

  // Nothing yet and nothing in flight: stay out of the way. The "Log cook"
  // action is the entry point, so an empty panel would be pure furniture.
  if (loading || entries.length === 0) return null;

  return (
    <section className="mt-10 border-t border-gray-100 dark:border-gray-800 pt-6">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Your cook log
        </h2>
        <span className="text-xs text-gray-400">
          {entries.length} {entries.length === 1 ? "cook" : "cooks"} · private to you
        </span>
      </div>

      {actionError && <p className="mb-2 text-sm text-red-600">{actionError}</p>}

      <ul className="divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-gray-100 dark:border-gray-800">
        {entries.map((entry) => {
          const isExpanded = expandedId === entry.id;
          const isEditing = editingId === entry.id;
          const hasNotes = Boolean(entry.notes);

          if (isEditing && draft) {
            return (
              <li key={entry.id} className="px-4 py-3">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      Date
                      <input
                        type="date"
                        value={draft.cookedAt}
                        onChange={(e) => { setDraft({ ...draft, cookedAt: e.target.value }); }}
                        className="rounded-lg border border-gray-200 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
                      />
                    </label>
                    <StarPicker
                      value={draft.rating}
                      onChange={(rating) => { setDraft({ ...draft, rating }); }}
                    />
                  </div>

                  <textarea
                    value={draft.notes}
                    onChange={(e) => { setDraft({ ...draft, notes: e.target.value }); }}
                    rows={3}
                    maxLength={2000}
                    placeholder="What would you change next time?"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                  />

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { void handleSave(entry); }}
                      disabled={saving}
                      className="rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditing}
                      disabled={saving}
                      className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </li>
            );
          }

          return (
            <li key={entry.id}>
              <div className="flex items-center gap-3 px-4 py-2.5">
                {/* The whole row is the toggle only when there's something to
                    reveal; otherwise it's static text and shouldn't offer a
                    click that does nothing. */}
                {hasNotes ? (
                  <button
                    type="button"
                    onClick={() => { setExpandedId(isExpanded ? null : entry.id); }}
                    aria-expanded={isExpanded}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span className="text-sm tabular-nums text-gray-700 dark:text-gray-300">
                      {formatDate(entry.cookedAt)}
                    </span>
                    {entry.rating !== null && <Stars rating={entry.rating} />}
                    <span className="ml-auto shrink-0 text-xs text-gray-400">
                      {isExpanded ? "Hide notes" : "Notes"}
                    </span>
                  </button>
                ) : (
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="text-sm tabular-nums text-gray-700 dark:text-gray-300">
                      {formatDate(entry.cookedAt)}
                    </span>
                    {entry.rating !== null && <Stars rating={entry.rating} />}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => { startEditing(entry); }}
                  className="shrink-0 text-gray-300 transition-colors hover:text-orange-400"
                  aria-label={`Edit cook log entry from ${formatDate(entry.cookedAt)}`}
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M8.5 1.5l2 2L4 10l-2.5.5L2 8l6.5-6.5z"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => { void handleRemove(entry.id); }}
                  disabled={removingId === entry.id}
                  className="shrink-0 text-gray-300 transition-colors hover:text-red-400 disabled:opacity-50"
                  aria-label={`Delete cook log entry from ${formatDate(entry.cookedAt)}`}
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none">
                    <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              {isExpanded && entry.notes && (
                <p className="whitespace-pre-wrap px-4 pb-3 text-sm text-gray-600 dark:text-gray-400">
                  {entry.notes}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
