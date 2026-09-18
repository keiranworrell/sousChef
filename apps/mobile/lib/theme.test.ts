import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  darkPalette,
  lightPalette,
  paletteFor,
  relativeLuminance,
  type Palette,
} from "./theme";

const palettes: [string, Palette][] = [
  ["light", lightPalette],
  ["dark", darkPalette],
];

describe("palette completeness", () => {
  it("defines the same tokens in both themes", () => {
    // A token present in one and missing in the other renders as `undefined`,
    // which React Native silently ignores — so the element keeps whatever it
    // inherited and the bug shows up as one unreadable label on one screen.
    expect(Object.keys(darkPalette).sort()).toEqual(Object.keys(lightPalette).sort());
  });

  it("has a value for every token", () => {
    for (const [name, palette] of palettes) {
      for (const [token, value] of Object.entries(palette)) {
        expect(value, `${name}.${token}`).toBeTruthy();
      }
    }
  });

  it("actually differs between themes", () => {
    // Guards against a copy-paste where dark is light under a new name.
    const shared = (Object.keys(lightPalette) as (keyof Palette)[]).filter(
      (token) => lightPalette[token] === darkPalette[token],
    );
    // `shadow` is black in both, legitimately. Nothing else should match.
    expect(shared).toEqual(["shadow"]);
  });
});

/**
 * Contrast the light theme is known to fail, today, before dark mode existed.
 *
 * These are not new. They are the existing palette measured honestly:
 *
 *  - white on the `#f97316` button fill is 2.80:1. This is the primary button
 *    in the whole app. `#c2410c` would reach 5.18:1.
 *  - `#9ca3af` hint text on the page background is 2.43:1, used ~130 times.
 *    `#6b7280` would reach 4.63:1.
 *  - `#f97316` as link and icon colour on the background is 2.68:1.
 *
 * Fixing them means visibly restyling the light theme — a darker orange
 * everywhere and greyer hints — which is a design decision, not something to
 * slip into a dark mode change. So they are recorded rather than hidden: any
 * *new* shortfall fails the build, and this list is the debt, with the numbers
 * needed to pay it off.
 *
 * The dark palette is new, so it is held to the real standard with no
 * exemptions.
 */
const KNOWN_LIGHT_GAPS = new Set([
  "light: textFaint on bg",
  "light: textFaint on surface",
  "light: onAccent on accent",
  "light: accent on bg",
  "light: accent on surface",
]);

function expectContrast(
  label: string,
  foreground: string,
  background: string,
  minimum: number,
): void {
  const ratio = contrastRatio(foreground, background);
  if (KNOWN_LIGHT_GAPS.has(label)) {
    // Pinned, so an accidental improvement or regression both get noticed.
    expect(ratio, `${label} is a known gap at ${ratio.toFixed(2)}:1`).toBeLessThan(minimum);
    return;
  }
  expect(ratio, `${label} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(minimum);
}

describe("contrast", () => {
  /** WCAG AA for body text. */
  const AA = 4.5;
  /** WCAG AA for large or bold text, and for meaningful non-text. */
  const AA_LARGE = 3;

  const bodyText: (keyof Palette)[] = ["text", "textSecondary", "textMuted"];

  it("keeps body text readable on the background and on cards", () => {
    for (const [name, palette] of palettes) {
      for (const token of bodyText) {
        expectContrast(`${name}: ${token} on bg`, palette[token], palette.bg, AA);
        expectContrast(`${name}: ${token} on surface`, palette[token], palette.surface, AA);
      }
    }
  });

  it("keeps the quietest text above the large-text threshold", () => {
    // textFaint is hints and placeholders, allowed to be quieter — but 3:1 is
    // the floor at which text stops being text and becomes texture.
    for (const [name, palette] of palettes) {
      expectContrast(`${name}: textFaint on bg`, palette.textFaint, palette.bg, AA_LARGE);
      expectContrast(`${name}: textFaint on surface`, palette.textFaint, palette.surface, AA_LARGE);
    }
  });

  it("keeps label text legible on a solid accent fill", () => {
    for (const [name, palette] of palettes) {
      expectContrast(`${name}: onAccent on accent`, palette.onAccent, palette.accent, AA);
    }
  });

  it("keeps accent text legible on its tinted background", () => {
    for (const [name, palette] of palettes) {
      expectContrast(
        `${name}: accentText on accentSurface`,
        palette.accentText,
        palette.accentSurface,
        AA,
      );
    }
  });

  it("keeps accent links and icons distinguishable", () => {
    for (const [name, palette] of palettes) {
      expectContrast(`${name}: accent on bg`, palette.accent, palette.bg, AA_LARGE);
      expectContrast(`${name}: accent on surface`, palette.accent, palette.surface, AA_LARGE);
    }
  });

  it("keeps danger and success legible on the background", () => {
    for (const [name, palette] of palettes) {
      for (const token of ["danger", "success"] as const) {
        expectContrast(`${name}: ${token} on bg`, palette[token], palette.bg, AA_LARGE);
      }
    }
  });
});

describe("dark surfaces lift as they come forward", () => {
  it("puts cards above the background in both themes", () => {
    // On a dark screen a raised card reads as nearer and a darker one reads as
    // a hole, so the dark values are not the light ones inverted. Asserting it
    // stops a later tweak from mirroring light by accident.
    expect(relativeLuminance(darkPalette.surface))
      .toBeGreaterThan(relativeLuminance(darkPalette.bg));
    expect(relativeLuminance(lightPalette.surface))
      .toBeGreaterThan(relativeLuminance(lightPalette.bg));
  });

  it("puts sunken wells above cards in dark and below them in light", () => {
    expect(relativeLuminance(darkPalette.surfaceSunken))
      .toBeGreaterThan(relativeLuminance(darkPalette.surface));
    expect(relativeLuminance(lightPalette.surfaceSunken))
      .toBeLessThan(relativeLuminance(lightPalette.surface));
  });
});

describe("paletteFor", () => {
  it("returns the matching palette", () => {
    expect(paletteFor("light")).toBe(lightPalette);
    expect(paletteFor("dark")).toBe(darkPalette);
  });
});

describe("contrastRatio", () => {
  it("is 21:1 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });

  it("is 1:1 for a colour against itself", () => {
    expect(contrastRatio("#f97316", "#f97316")).toBeCloseTo(1, 5);
  });

  it("does not care which way round the arguments are", () => {
    expect(contrastRatio("#111827", "#f9fafb")).toBeCloseTo(
      contrastRatio("#f9fafb", "#111827"),
      5,
    );
  });

  it("understands three-digit hex", () => {
    expect(contrastRatio("#fff", "#000")).toBeCloseTo(21, 1);
  });
});
