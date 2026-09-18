import type { CookLogEntry, UpdateCookLogInput } from "../types";

/**
 * The editing logic behind the cook log panels, kept out of the components.
 *
 * None of this needs React, a DOM or an API client, and leaving it in the
 * component meant testing it dragged all three in — which is how it got as far
 * as CI before failing to resolve.
 *
 * It lives in shared rather than in apps/web because mobile now renders the
 * same panel. The absent-versus-null rule below is a property of the endpoint,
 * not of either client, so a second copy would be a second chance to get it
 * wrong on one platform only.
 */

export type CookLogDraft = {
  rating: number | null;
  /** yyyy-mm-dd, as an <input type="date"> gives it. */
  cookedAt: string;
  notes: string;
};

/** The local calendar day of an ISO timestamp, for an <input type="date">. */
export function toDateInputValue(iso: string): string {
  const d = new Date(iso);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/** A draft pre-filled from an existing entry. */
export function draftFromEntry(entry: CookLogEntry): CookLogDraft {
  return {
    rating: entry.rating,
    cookedAt: toDateInputValue(entry.cookedAt),
    notes: entry.notes ?? "",
  };
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
