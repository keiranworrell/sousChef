/**
 * Recipe scaling utility.
 *
 * Provides sense-aware scaling for ingredient quantities:
 *  - Eggs round to the nearest ½ (you can split an egg in baking).
 *  - Leavening agents (baking powder/soda, bicarbonate, yeast, cream of
 *    tartar) use a diminishing-returns curve beyond 2× — they stop working
 *    effectively in excess and can make baked goods taste bitter.
 *  - Everything else multiplies linearly.
 *
 * Quantities are formatted as readable strings using Unicode vulgar fractions
 * (¼, ½, ¾ etc.) where appropriate, falling back to one decimal place.
 */

// ─── Fraction display ──────────────────────────────────────────────────────────

const FRACTIONS: ReadonlyArray<{ value: number; display: string }> = [
  { value: 1 / 8, display: "⅛" },
  { value: 1 / 4, display: "¼" },
  { value: 1 / 3, display: "⅓" },
  { value: 3 / 8, display: "⅜" },
  { value: 1 / 2, display: "½" },
  { value: 5 / 8, display: "⅝" },
  { value: 2 / 3, display: "⅔" },
  { value: 3 / 4, display: "¾" },
  { value: 7 / 8, display: "⅞" },
];

const TOLERANCE = 0.02;

function closeFraction(frac: number): string | null {
  for (const { value, display } of FRACTIONS) {
    if (Math.abs(frac - value) <= TOLERANCE) return display;
  }
  return null;
}

/**
 * Format a positive number as a human-readable cooking quantity.
 *
 * Examples:
 *   2        → "2"
 *   0.5      → "½"
 *   1.5      → "1 ½"
 *   0.333    → "⅓"
 *   2.1      → "2.1"
 */
export function formatQuantity(value: number): string {
  if (value <= 0) return "0";

  const whole = Math.floor(value);
  const frac = value - whole;

  // Close enough to a whole number?
  if (frac < TOLERANCE) {
    return String(whole === 0 ? Math.round(value) : whole);
  }

  // Close enough to whole + 1 (e.g. 0.97)?
  if (frac > 1 - TOLERANCE) {
    return String(whole + 1);
  }

  const fracStr = closeFraction(frac);
  if (fracStr) {
    return whole > 0 ? `${whole} ${fracStr}` : fracStr;
  }

  // No nice fraction — round to 1 decimal place
  return String(Math.round(value * 10) / 10);
}

// ─── Sense rules ──────────────────────────────────────────────────────────────

const EGG_RE = /\beggs?\b/i;
const EGGPLANT_RE = /eggplant|aubergine/i;

const LEAVENING_RE =
  /baking\s+powder|baking\s+soda|bicarbonate|bicarb|active\s+dry\s+yeast|instant\s+yeast|dried\s+yeast|yeast|cream\s+of\s+tartar/i;

function isEgg(name: string): boolean {
  return EGG_RE.test(name) && !EGGPLANT_RE.test(name);
}

function isLeavening(name: string): boolean {
  return LEAVENING_RE.test(name);
}

/**
 * Diminishing-returns multiplier for leavening agents.
 * Linear up to 2×, then 75 % of the remaining scale.
 *
 *   1×  → 1×
 *   2×  → 2×
 *   3×  → 2.75×
 *   4×  → 3.5×
 */
function leaveningFactor(scaleFactor: number): number {
  if (scaleFactor <= 2) return scaleFactor;
  return 2 + (scaleFactor - 2) * 0.75;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Scale a recipe ingredient quantity, applying sense rules where relevant,
 * and return a formatted string suitable for display.
 *
 * Returns `null` if the original quantity was `null` (i.e. "to taste" /
 * unspecified).
 *
 * @param quantity    Original quantity value.
 * @param name        Ingredient name — used to detect eggs and leavening.
 * @param scaleFactor New servings ÷ original servings.
 */
export function scaleQuantity(
  quantity: number | null,
  name: string,
  scaleFactor: number,
): string | null {
  if (quantity === null) return null;
  if (scaleFactor === 1) return formatQuantity(quantity);

  let scaled: number;

  if (isEgg(name)) {
    // Round to nearest ½ egg; ensure at least ½ if original was non-zero
    scaled = Math.round(quantity * scaleFactor * 2) / 2;
    if (scaled === 0 && quantity > 0) scaled = 0.5;
  } else if (isLeavening(name)) {
    scaled = quantity * leaveningFactor(scaleFactor);
  } else {
    scaled = quantity * scaleFactor;
  }

  return formatQuantity(scaled);
}
