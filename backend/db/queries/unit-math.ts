/**
 * Unit conversion and quantity combination, shared by everything that has to
 * add two amounts of the same thing together.
 *
 * Extracted because there are now two callers: the automatic aggregation that
 * builds a shopping list from a meal plan, and the manual merge a user performs
 * when that aggregation didn't catch something. Those two must agree. If a
 * user merges "spring onions" and "scallions" by hand and gets a different
 * answer from the one the automatic path would have produced, the product has
 * two opinions about arithmetic, and the one they see depends on how the line
 * got there.
 */

/** Converts weight measurements to grams. */
const WEIGHT_TO_G: Record<string, number> = {
  g: 1, gram: 1, grams: 1, gramme: 1, grammes: 1,
  kg: 1000, kilo: 1000, kilos: 1000, kilogram: 1000, kilograms: 1000,
  mg: 0.001,
  oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
  lb: 453.592, lbs: 453.592, pound: 453.592, pounds: 453.592,
};

/** Converts volume measurements to millilitres. */
const VOLUME_TO_ML: Record<string, number> = {
  ml: 1, milliliter: 1, milliliters: 1, millilitre: 1, millilitres: 1,
  l: 1000, liter: 1000, liters: 1000, litre: 1000, litres: 1000,
  tsp: 4.92892, teaspoon: 4.92892, teaspoons: 4.92892,
  tbsp: 14.7868, tablespoon: 14.7868, tablespoons: 14.7868,
  cup: 236.588, cups: 236.588,
  "fl oz": 29.5735, "fluid oz": 29.5735,
  pt: 473.176, pint: 473.176, pints: 473.176,
  qt: 946.353, quart: 946.353, quarts: 946.353,
  gal: 3785.41, gallon: 3785.41, gallons: 3785.41,
};

export type Normalised = { quantity: number | null; unit: string | null };

/** Weights become grams, volumes become millilitres, anything else is left alone. */
export function normaliseUnit(quantity: number | null, unit: string | null): Normalised {
  if (!unit) return { quantity, unit: null };
  const u = unit.toLowerCase().trim();

  if (Object.prototype.hasOwnProperty.call(WEIGHT_TO_G, u)) {
    const factor = WEIGHT_TO_G[u]!;
    return { quantity: quantity !== null ? quantity * factor : null, unit: "g" };
  }
  if (Object.prototype.hasOwnProperty.call(VOLUME_TO_ML, u)) {
    const factor = VOLUME_TO_ML[u]!;
    return { quantity: quantity !== null ? quantity * factor : null, unit: "ml" };
  }
  return { quantity, unit };
}

/** Trims float noise: 1.5 stays 1.5, 2.0000000000000004 becomes 2. */
export function formatQuantity(n: number): string {
  return String(roundQuantity(n));
}

/**
 * The same trim, kept as a number.
 *
 * Needed because the rounding used to be applied only where a quantity was
 * turned into a string. A summed amount written to the database kept every
 * digit, so 1 tbsp plus 1 tsp stored 19.715720000000002 millilitres and the
 * shopping list rendered it in full. Unit conversion produces these constantly;
 * anything that adds converted amounts has to round the result, not just its
 * own display of it.
 */
export function roundQuantity(n: number): number {
  return Math.round(n * 100) / 100;
}

export type Measured = { quantity: number | null; unit: string | null };

export type Combined = {
  /** The unit the line is expressed in, or null if nothing was measured. */
  unit: string | null;
  /** Summed quantity in that unit, or null. */
  quantity: number | null;
  /**
   * Amounts that could not be expressed in the primary unit, already formatted
   * — "200 ml", "plus a little more". Mentioned rather than dropped.
   */
  extras: string[];
};

/**
 * Adds a set of measurements together.
 *
 * The line is expressed in whichever unit carries the most measured entries.
 * Anything left over is returned as `extras` rather than discarded: silently
 * losing "200 ml" because the line happens to be in grams would be the same
 * class of error as the duplicate row the merge is meant to remove. Grams and
 * millilitres cannot be added without knowing the density of the ingredient,
 * and guessing at that is worse than saying both numbers out loud.
 *
 * An entry with no quantity at all — "a sprinkle" — contributes
 * "plus a little more", so the fact that there was extra survives even though
 * the amount never existed as a number.
 */
export function combineQuantities(items: Measured[]): Combined {
  const byUnit = new Map<string, number>();
  let hasUnquantified = false;

  for (const item of items) {
    const { quantity, unit } = normaliseUnit(item.quantity, item.unit);
    if (quantity === null) {
      hasUnquantified = true;
      continue;
    }
    const key = unit ?? "";
    byUnit.set(key, (byUnit.get(key) ?? 0) + quantity);
  }

  const units = [...byUnit.entries()].sort((a, b) => b[1] - a[1]);
  const [primary, ...rest] = units;

  const extras = rest.map(([unit, qty]) =>
    unit ? `${formatQuantity(qty)} ${unit}` : formatQuantity(qty),
  );
  // Only worth saying when there is a measured amount for it to be extra *to*.
  // On a line that is nothing but "a pinch", "plus a little more" is noise.
  if (hasUnquantified && primary) extras.push("plus a little more");

  return {
    unit: primary ? primary[0] || null : null,
    quantity: primary ? roundQuantity(primary[1]) : null,
    extras,
  };
}

/** The `(+ 200 ml, plus a little more)` suffix, or "" when there is nothing extra. */
export function extrasSuffix(extras: string[]): string {
  return extras.length > 0 ? ` (+ ${extras.join(", ")})` : "";
}
