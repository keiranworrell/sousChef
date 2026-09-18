/**
 * The app's colours, named for what they mean rather than what they are.
 *
 * Before this there were 767 hardcoded hex values across 45 files, and only 30
 * distinct ones — which is to say the palette already existed, it was just
 * written out longhand everywhere. The tokens below are that palette, given
 * names, so a second set of values can exist for dark.
 *
 * Semantic names are the point. `surface` survives someone deciding cards
 * should be a shade warmer; `gray50` does not, and a token called `gray50`
 * holding `#151b26` in dark mode is a lie that someone will eventually believe.
 *
 * Cooking mode is deliberately absent from all of this. Both cook screens are
 * dark in either theme — a fullscreen view you read at arm's length across a
 * hob wants low glare whatever the rest of the app is doing, and web does the
 * same with an unconditional `bg-gray-950`.
 */

export type Palette = {
  /** Screen background. */
  bg: string;
  /** Cards, sheets, inputs — anything sitting on `bg`. */
  surface: string;
  /** Wells inside a surface: image placeholders, progress tracks. */
  surfaceSunken: string;

  /** Hairlines and card borders. */
  border: string;
  /** Input and button outlines, which need to be seen. */
  borderStrong: string;

  /** Headings and anything that must be read. */
  text: string;
  /** Body copy. */
  textSecondary: string;
  /** Supporting detail: metadata, counts. */
  textMuted: string;
  /** Hints, placeholders, disabled. The quietest thing still worth reading. */
  textFaint: string;

  /** The brand orange, for fills and primary actions. */
  accent: string;
  /** Emphasis, and accent text on a tinted background. */
  accentStrong: string;
  /** Tinted backgrounds: selected chips, callouts. */
  accentSurface: string;
  /** Border for a tinted background. */
  accentBorder: string;
  /** Text sitting on `accentSurface`. */
  accentText: string;
  /** Text and icons sitting on a solid `accent` fill. */
  onAccent: string;

  danger: string;
  dangerBorder: string;

  success: string;
  successSurface: string;
  successBorder: string;

  /** The heart on community recipes. */
  like: string;

  /** Behind a modal. */
  overlay: string;
  /** Android elevation shadow. */
  shadow: string;
};

export const lightPalette: Palette = {
  bg: "#f9fafb",
  surface: "#ffffff",
  surfaceSunken: "#f3f4f6",

  border: "#e5e7eb",
  borderStrong: "#d1d5db",

  text: "#111827",
  textSecondary: "#374151",
  textMuted: "#6b7280",
  textFaint: "#9ca3af",

  accent: "#f97316",
  accentStrong: "#ea580c",
  accentSurface: "#fff7ed",
  accentBorder: "#fed7aa",
  accentText: "#9a3412",
  onAccent: "#ffffff",

  danger: "#dc2626",
  dangerBorder: "#fecaca",

  success: "#16a34a",
  successSurface: "#f0fdf4",
  successBorder: "#bbf7d0",

  like: "#f43f5e",

  overlay: "rgba(0,0,0,0.4)",
  shadow: "#000000",
};

/**
 * Dark is not the light palette inverted.
 *
 * Two things that would go wrong if it were. Backgrounds lift as they come
 * forward — `surface` is *lighter* than `bg` here, where in light it is
 * whiter — because on a dark screen a raised card reads as nearer, and a
 * darker card reads as a hole. And the muted greys have to move much less than
 * the backgrounds: light grey text on near-black is already high contrast, so
 * mirroring the light values exactly would make every hint shout.
 *
 * The orange lightens (`#fb923c`) for text and icons, where `#f97316` on a
 * dark background is under 3:1. Solid fills keep the brand `#f97316`, which is
 * bright enough to carry white text either way.
 */
export const darkPalette: Palette = {
  bg: "#0b0f17",
  surface: "#151b26",
  surfaceSunken: "#1f2733",

  border: "#263040",
  borderStrong: "#3a4657",

  text: "#f3f4f6",
  textSecondary: "#d4dae3",
  textMuted: "#9aa7b8",
  textFaint: "#7b8798",

  accent: "#fb923c",
  accentStrong: "#fdba74",
  accentSurface: "#2a1c10",
  accentBorder: "#7c4a1c",
  accentText: "#fdba74",
  onAccent: "#1a1207",

  danger: "#f87171",
  dangerBorder: "#7f1d1d",

  success: "#4ade80",
  successSurface: "#0d2818",
  successBorder: "#166534",

  like: "#fb7185",

  overlay: "rgba(0,0,0,0.6)",
  shadow: "#000000",
};

export type ThemeName = "light" | "dark";

export function paletteFor(theme: ThemeName): Palette {
  return theme === "dark" ? darkPalette : lightPalette;
}

// ─── Contrast ─────────────────────────────────────────────────────────────────

/**
 * WCAG relative luminance, for the contrast checks in the tests.
 *
 * Lives here rather than in the test file so the ratio can also be asserted on
 * any palette added later, rather than only on the two that exist today.
 */
export function relativeLuminance(hex: string): number {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value.split("").map((c) => c + c).join("")
      : value;

  const channels = [0, 2, 4].map((i) => {
    const part = parseInt(full.slice(i, i + 2), 16) / 255;
    return part <= 0.03928 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** WCAG contrast ratio between two opaque colours, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const lighter = Math.max(relativeLuminance(a), relativeLuminance(b));
  const darker = Math.min(relativeLuminance(a), relativeLuminance(b));
  return (lighter + 0.05) / (darker + 0.05);
}
