import { describe, expect, it } from "vitest";
import {
  PREFERENCE_LABELS,
  PREFERENCE_ORDER,
  parsePreference,
  resolveTheme,
} from "./theme-preference";

describe("resolveTheme", () => {
  it("honours an explicit choice whatever the system says", () => {
    expect(resolveTheme("light", "dark")).toBe("light");
    expect(resolveTheme("dark", "light")).toBe("dark");
  });

  it("follows the system when asked to", () => {
    expect(resolveTheme("system", "dark")).toBe("dark");
    expect(resolveTheme("system", "light")).toBe("light");
  });

  it("falls back to light when the system has not answered", () => {
    // useColorScheme() is null before the native module replies. Light first
    // is a flicker; dark first is a flash in a dark room.
    expect(resolveTheme("system", null)).toBe("light");
    expect(resolveTheme("system", undefined)).toBe("light");
  });

  it("handles Android's 'unspecified'", () => {
    // Real value from React Native's ColorSchemeName, sent when the OS has no
    // preference to report — below API 29 there is no system dark setting at
    // all. This is what the narrow type missed.
    expect(resolveTheme("system", "unspecified")).toBe("light");
    expect(resolveTheme("dark", "unspecified")).toBe("dark");
    expect(resolveTheme("light", "unspecified")).toBe("light");
  });

  it("still honours an explicit dark choice before the system answers", () => {
    // Someone who has chosen dark should not get a white flash on every cold
    // start while the native module wakes up.
    expect(resolveTheme("dark", null)).toBe("dark");
  });
});

describe("parsePreference", () => {
  it("accepts the three valid values", () => {
    expect(parsePreference("system")).toBe("system");
    expect(parsePreference("light")).toBe("light");
    expect(parsePreference("dark")).toBe("dark");
  });

  it("defaults to system for anything else", () => {
    // Storage holds whatever an older build wrote, a half-finished write, or
    // nothing. None of those should pick a theme the user never asked for.
    expect(parsePreference(null)).toBe("system");
    expect(parsePreference(undefined)).toBe("system");
    expect(parsePreference("")).toBe("system");
    expect(parsePreference("Dark")).toBe("system");
    expect(parsePreference("auto")).toBe("system");
    expect(parsePreference("{}")).toBe("system");
  });
});

describe("the settings control", () => {
  it("offers system first", () => {
    // It is the default, and the one most people should stay on.
    expect(PREFERENCE_ORDER[0]).toBe("system");
  });

  it("has a label for every option and an option for every label", () => {
    expect(PREFERENCE_ORDER.map((p) => PREFERENCE_LABELS[p]))
      .toEqual(["System", "Light", "Dark"]);
    expect(Object.keys(PREFERENCE_LABELS).sort()).toEqual([...PREFERENCE_ORDER].sort());
  });
});
