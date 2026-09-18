import type { ThemeName } from "./theme";

/**
 * What the user chose, which is not the same as what they get.
 *
 * Three states, not web's two. Web toggles between light and dark and stores
 * the result, which means once you have touched it you can never follow the
 * system again — on a laptop that is mildly annoying, on a phone with a dark
 * schedule tied to sunset it is worse. "System" is also the Android
 * convention, so it is the default.
 */
export type ThemePreference = "system" | "light" | "dark";

export const THEME_PREFERENCE_KEY = "souschef.themePreference";

const VALID: ThemePreference[] = ["system", "light", "dark"];

/**
 * What `useColorScheme()` can actually return.
 *
 * Wider than "light" | "dark" | null: React Native's own `ColorSchemeName`
 * includes the literal `"unspecified"`, which Android sends when it has no
 * preference to report — below API 29 there is no system dark setting at all.
 * Typing this narrowly compiled fine against the values I expected and failed
 * against the ones the platform sends.
 */
export type SystemScheme = "light" | "dark" | "unspecified" | null | undefined;

/**
 * The theme to actually render.
 *
 * Anything that is not an explicit "dark" falls back to light: that covers a
 * system with no preference, a device too old to have one, and the moment
 * before the native module has answered. Light-then-dark is a flicker;
 * dark-then-light is a flash in a dark room, which is the one that hurts.
 */
export function resolveTheme(
  preference: ThemePreference,
  systemScheme: SystemScheme,
): ThemeName {
  if (preference === "light") return "light";
  if (preference === "dark") return "dark";
  return systemScheme === "dark" ? "dark" : "light";
}

/**
 * A stored preference, or the default if it is missing or nonsense.
 *
 * Storage holds strings written by an older build, a half-finished write, or
 * nothing at all. Anything unrecognised becomes "system", which is also what a
 * new install gets — so a corrupted value degrades to the sensible default
 * rather than to a theme the user never picked.
 */
export function parsePreference(stored: string | null | undefined): ThemePreference {
  return VALID.includes(stored as ThemePreference)
    ? (stored as ThemePreference)
    : "system";
}

/** The label for each option in settings. */
export const PREFERENCE_LABELS: Record<ThemePreference, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

export const PREFERENCE_ORDER: ThemePreference[] = ["system", "light", "dark"];
