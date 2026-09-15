"use client";

import React, { useState } from "react";
import type { CookHistoryEntry, LogCookInput } from "@souschef/shared";
import { getApiClient } from "@/lib/api";

type Props = {
  recipeId: string;
  onClose: () => void;
  onLogged: (entry: CookHistoryEntry) => void;
};

function todayISODate(): string {
  // Local date, not UTC: someone cooking at 9pm in BST should see today's date
  // in the field, and toISOString would hand them tomorrow's.
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

export default function CookLogModal({
  recipeId,
  onClose,
  onLogged,
}: Props): React.JSX.Element {
  // Null, not 0. A cook logged without a rating is a real and common thing —
  // "I made this on Tuesday" — and is different from a rating of zero, which
  // the scale doesn't have.
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [cookedAt, setCookedAt] = useState(todayISODate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const input: LogCookInput = {
      rating,
      notes: notes.trim() || null,
      cookedAt: cookedAt || null,
    };
    try {
      const api = await getApiClient();
      const res = await api.recipes.logCook(recipeId, input);
      if ("error" in res) throw new Error(res.error.message);
      onLogged(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this cook");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 py-4">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Log a cook</h2>
            <p className="mt-0.5 text-xs text-gray-400">Only you can see this</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <svg className="h-5 w-5" viewBox="0 0 16 16" fill="none">
              <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4 px-5 py-4">
          <div>
            <label className="label">Rating</label>
            <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  role="radio"
                  aria-checked={rating === star}
                  aria-label={`${star} ${star === 1 ? "star" : "stars"}`}
                  // Tapping the current rating clears it, so a mis-tap doesn't
                  // trap the user into submitting a rating they didn't mean.
                  onClick={() => setRating((r) => (r === star ? null : star))}
                  className={`text-2xl leading-none transition-colors ${
                    rating !== null && star <= rating
                      ? "text-orange-400"
                      : "text-gray-200 hover:text-orange-200 dark:text-gray-700"
                  }`}
                >
                  ★
                </button>
              ))}
              <span className="ml-2 text-xs text-gray-400">
                {rating === null ? "Optional" : "Tap again to clear"}
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="cookNotes" className="label">
              Notes
            </label>
            <textarea
              id="cookNotes"
              className="input min-h-[80px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
              placeholder="What would you change next time?"
            />
          </div>

          <div>
            <label htmlFor="cookedAt" className="label">
              Date cooked
            </label>
            <input
              id="cookedAt"
              type="date"
              className="input"
              value={cookedAt}
              max={todayISODate()}
              onChange={(e) => setCookedAt(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
