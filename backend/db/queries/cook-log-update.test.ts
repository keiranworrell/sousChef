import { describe, expect, it } from "vitest";
import { buildCookLogUpdate } from "./cook-history-queries";

/**
 * The feature is three-state handling, so that is what is tested.
 *
 * Absent means "leave it", null means "clear it". Every bug this function can
 * have is silent: it writes over a field the user never mentioned, and the only
 * symptom is a rating that quietly disappeared some time after they edited the
 * notes.
 */
describe("buildCookLogUpdate", () => {
  it("returns null when the caller asked for nothing", () => {
    expect(buildCookLogUpdate({})).toBeNull();
  });

  it("leaves out fields that were not mentioned", () => {
    // The case that matters: editing only the notes must not touch the rating.
    expect(buildCookLogUpdate({ notes: "less salt" })).toEqual({ notes: "less salt" });
    expect(buildCookLogUpdate({ rating: 4 })).toEqual({ rating: 4 });
  });

  it("treats an explicit null as clear, not as absent", () => {
    const update = buildCookLogUpdate({ rating: null });
    expect(update).toEqual({ rating: null });
    expect(update && "rating" in update).toBe(true);
  });

  it("stores empty and whitespace-only notes as null", () => {
    // Matches what logCook does on insert: "" would put an expand affordance on
    // a row with nothing behind it.
    expect(buildCookLogUpdate({ notes: "" })).toEqual({ notes: null });
    expect(buildCookLogUpdate({ notes: "   " })).toEqual({ notes: null });
    expect(buildCookLogUpdate({ notes: "  trim me  " })).toEqual({ notes: "trim me" });
  });

  it("converts a supplied date to a Date", () => {
    const update = buildCookLogUpdate({ cookedAt: "2026-09-16" });
    expect(update?.cookedAt).toBeInstanceOf(Date);
  });

  it("combines several fields in one update", () => {
    expect(buildCookLogUpdate({ rating: 5, notes: "perfect", cookedAt: "2026-09-16" })).toEqual({
      rating: 5,
      notes: "perfect",
      cookedAt: new Date("2026-09-16"),
    });
  });

  it("does not invent a cookedAt when none was sent", () => {
    // A PATCH that silently reset the date to now would be a data loss bug
    // wearing the clothes of a default.
    const update = buildCookLogUpdate({ rating: 3 });
    expect(update && "cookedAt" in update).toBe(false);
  });
});
