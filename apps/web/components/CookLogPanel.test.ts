import { describe, expect, it } from "vitest";
import type { CookLogEntry } from "@souschef/shared";
import { diffCookLogEdit, toDateInputValue, type CookLogDraft } from "./CookLogPanel";

/**
 * The form sends a diff, not the draft. Sending the whole draft would make
 * editing one field overwrite the others with whatever the form was holding —
 * which is exactly what the endpoint's absent/null distinction exists to avoid,
 * and it would be undone here if the component got this wrong.
 */

const entry: CookLogEntry = {
  id: "e1",
  userId: "u1",
  recipeId: "r1",
  cookedAt: "2026-09-16T18:30:00.000Z",
  rating: 4,
  notes: "a bit salty",
};

function draftOf(e: CookLogEntry): CookLogDraft {
  return { rating: e.rating, cookedAt: toDateInputValue(e.cookedAt), notes: e.notes ?? "" };
}

describe("diffCookLogEdit", () => {
  it("sends nothing when nothing was touched", () => {
    expect(diffCookLogEdit(entry, draftOf(entry))).toEqual({});
  });

  it("sends only the field that changed", () => {
    expect(diffCookLogEdit(entry, { ...draftOf(entry), notes: "much better" })).toEqual({
      notes: "much better",
    });
  });

  it("sends null to clear a rating", () => {
    expect(diffCookLogEdit(entry, { ...draftOf(entry), rating: null })).toEqual({ rating: null });
  });

  it("sends null for notes emptied out", () => {
    expect(diffCookLogEdit(entry, { ...draftOf(entry), notes: "   " })).toEqual({ notes: null });
  });

  it("leaves the timestamp alone when the day did not change", () => {
    // The form only offers a day. If it sent cookedAt every time, saving a note
    // would silently reset the entry's time to midnight.
    const untouched = diffCookLogEdit(entry, draftOf(entry));
    expect("cookedAt" in untouched).toBe(false);
  });

  it("sends the date when the day did change", () => {
    expect(diffCookLogEdit(entry, { ...draftOf(entry), cookedAt: "2026-09-10" })).toEqual({
      cookedAt: "2026-09-10",
    });
  });

  it("treats a null note and an empty box as the same state", () => {
    const noNotes: CookLogEntry = { ...entry, notes: null };
    expect(diffCookLogEdit(noNotes, draftOf(noNotes))).toEqual({});
    expect(diffCookLogEdit(noNotes, { ...draftOf(noNotes), notes: "first note" })).toEqual({
      notes: "first note",
    });
  });
});
