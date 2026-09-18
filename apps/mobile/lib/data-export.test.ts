import { describe, expect, it } from "vitest";
import { exportFileName } from "./data-export";

describe("exportFileName", () => {
  it("says what it is and when it was taken", () => {
    expect(exportFileName(new Date(2026, 8, 18, 12, 0, 0)))
      .toBe("souschef-export-2026-09-18.json");
  });

  it("pads single digits", () => {
    expect(exportFileName(new Date(2026, 0, 5, 12, 0, 0)))
      .toBe("souschef-export-2026-01-05.json");
  });

  it("uses the local date, not UTC", () => {
    // 11pm on the 18th in a timezone ahead of UTC is still the 18th to the
    // person holding the phone. toISOString would name it the 19th.
    const lateEvening = new Date(2026, 8, 18, 23, 30, 0);
    expect(exportFileName(lateEvening)).toBe("souschef-export-2026-09-18.json");
  });

  it("ends in .json, so the share sheet offers sensible apps", () => {
    expect(exportFileName()).toMatch(/\.json$/);
  });
});
