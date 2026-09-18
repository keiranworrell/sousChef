import { describe, expect, it } from "vitest";
import { labelForDay, recentDays } from "./recent-days";

// Local noon, so the day cannot slide either side of a timezone offset and
// make the test depend on where CI happens to run.
function localNoon(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0);
}

describe("recentDays", () => {
  it("starts at today and counts backwards", () => {
    const days = recentDays(localNoon(2026, 9, 18), 4);
    expect(days.map((d) => d.iso)).toEqual([
      "2026-09-18",
      "2026-09-17",
      "2026-09-16",
      "2026-09-15",
    ]);
  });

  it("names the first two days rather than dating them", () => {
    const days = recentDays(localNoon(2026, 9, 18), 3);
    expect(days.map((d) => d.label)).toEqual(["Today", "Yesterday", "Wed 16"]);
  });

  it("crosses a month boundary", () => {
    const days = recentDays(localNoon(2026, 10, 2), 4);
    expect(days.map((d) => d.iso)).toEqual([
      "2026-10-02",
      "2026-10-01",
      "2026-09-30",
      "2026-09-29",
    ]);
  });

  it("crosses a year boundary", () => {
    const days = recentDays(localNoon(2027, 1, 1), 2);
    expect(days.map((d) => d.iso)).toEqual(["2027-01-01", "2026-12-31"]);
  });

  it("handles a leap day", () => {
    const days = recentDays(localNoon(2028, 3, 1), 2);
    expect(days.map((d) => d.iso)).toEqual(["2028-03-01", "2028-02-29"]);
  });

  it("never repeats a day", () => {
    // The reason this exists: stepping back by 24h of milliseconds produces a
    // duplicate on the 23-hour clock-change day. 25 October 2026 is the BST to
    // GMT change in the UK.
    const days = recentDays(localNoon(2026, 10, 26), 5);
    expect(new Set(days.map((d) => d.iso)).size).toBe(days.length);
  });

  it("returns nothing for a count of zero", () => {
    expect(recentDays(localNoon(2026, 9, 18), 0)).toEqual([]);
  });
});

describe("labelForDay", () => {
  const today = localNoon(2026, 9, 18);

  it("uses the friendly label when the day is on the strip", () => {
    expect(labelForDay("2026-09-17", today, 14)).toBe("Yesterday");
  });

  it("falls back to a full date for an older entry", () => {
    // An entry from months ago still has to render as something, and "Today"
    // would be a plain lie.
    expect(labelForDay("2026-06-04", today, 14)).toBe("04/06/2026");
  });
});
