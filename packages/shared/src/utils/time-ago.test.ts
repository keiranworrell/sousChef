import { describe, expect, it } from "vitest";
import { timeAgo } from "./time-ago";

const now = new Date("2026-09-18T12:00:00.000Z");

function ago(ms: number): string {
  return timeAgo(new Date(now.getTime() - ms).toISOString(), now);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("timeAgo", () => {
  it("calls anything under a minute just now", () => {
    expect(ago(0)).toBe("just now");
    expect(ago(59 * 1000)).toBe("just now");
  });

  it("counts minutes, then hours, then days, then weeks", () => {
    expect(ago(MINUTE)).toBe("1m ago");
    expect(ago(59 * MINUTE)).toBe("59m ago");
    expect(ago(HOUR)).toBe("1h ago");
    expect(ago(23 * HOUR)).toBe("23h ago");
    expect(ago(DAY)).toBe("1d ago");
    expect(ago(6 * DAY)).toBe("6d ago");
    expect(ago(7 * DAY)).toBe("1w ago");
    expect(ago(28 * DAY)).toBe("4w ago");
  });

  it("falls back to a date once it stops being readable", () => {
    // 35 days. "5w ago" is harder to read than the date it happened.
    expect(ago(35 * DAY)).toBe("14/08/2026");
  });

  it("does not say a notification arrived in the future", () => {
    // Device and server clocks disagree by seconds all the time.
    expect(timeAgo(new Date(now.getTime() + 30 * 1000).toISOString(), now)).toBe("just now");
  });

  it("returns an empty string for an unparseable timestamp", () => {
    // Better a missing line than the literal text "NaN ago" under a message.
    expect(timeAgo("not a date", now)).toBe("");
  });
});
