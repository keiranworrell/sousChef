/**
 * Splits an ingredient line into quantity, unit and name.
 *
 * Every import path needs this. The Schema.org parser puts whole strings like
 * "300 g bread flour" into `name` and leaves quantity null — which looks fine
 * on the recipe page and quietly breaks everything downstream: scaling has
 * nothing to scale, and the shopping list can't add two amounts of flour
 * together because neither has a number.
 *
 * Deliberately conservative. A line it cannot confidently parse is returned
 * whole as the name, with null quantity and unit — exactly the state we have
 * today, so a failure to parse never makes things worse than not trying. It is
 * far better to leave "a good glug of oil" alone than to guess at a number.
 */

/** Unicode fractions people actually paste in. */
const VULGAR_FRACTIONS: Record<string, number> = {
  "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75,
  "⅕": 0.2, "⅖": 0.4, "⅗": 0.6, "⅘": 0.8,
  "⅙": 1 / 6, "⅚": 5 / 6, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
};

/**
 * Units we recognise, mapped to a canonical short form.
 *
 * Only genuine units of measure. Words like "clove", "slice" and "pinch" are
 * deliberately absent: "2 cloves garlic" should keep "cloves garlic" as the
 * name, because a shopping list that says "2 garlic" is worse than one that
 * says "2 cloves garlic", and nothing can usefully convert cloves to anything.
 */
const UNITS: Record<string, string> = {
  g: "g", gram: "g", grams: "g", gramme: "g", grammes: "g",
  kg: "kg", kilo: "kg", kilos: "kg", kilogram: "kg", kilograms: "kg",
  mg: "mg",
  ml: "ml", millilitre: "ml", millilitres: "ml", milliliter: "ml", milliliters: "ml",
  l: "l", litre: "l", litres: "l", liter: "l", liters: "l",
  oz: "oz", ounce: "oz", ounces: "oz",
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp",
  tbsp: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp",
  cup: "cup", cups: "cup",
  pint: "pint", pints: "pint",
  quart: "quart", quarts: "quart",
  gallon: "gallon", gallons: "gallon",
  fl: "fl oz",
};

export type ParsedIngredient = {
  name: string;
  quantity: number | null;
  unit: string | null;
};

/** "1 1/2" → 1.5, "3/4" → 0.75, "½" → 0.5, "2.5" → 2.5. Null if not a number. */
function parseAmount(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;

  // Vulgar fraction on its own, or following a whole number ("1½").
  const vulgarMatch = text.match(/^(\d*)\s*([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])$/);
  if (vulgarMatch) {
    const whole = vulgarMatch[1] ? Number(vulgarMatch[1]) : 0;
    const frac = VULGAR_FRACTIONS[vulgarMatch[2]!] ?? 0;
    return round(whole + frac);
  }

  // "1 1/2"
  const mixed = text.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const [, whole, num, den] = mixed;
    if (Number(den) === 0) return null;
    return round(Number(whole) + Number(num) / Number(den));
  }

  // "3/4"
  const fraction = text.match(/^(\d+)\/(\d+)$/);
  if (fraction) {
    const [, num, den] = fraction;
    if (Number(den) === 0) return null;
    return round(Number(num) / Number(den));
  }

  // "300", "2.5", "1,5" (some European sites use a decimal comma)
  const plain = text.match(/^(\d+(?:[.,]\d+)?)$/);
  if (plain) return round(Number(plain[1]!.replace(",", ".")));

  return null;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Canonical unit if the word is one, else null. */
function matchUnit(word: string): string | null {
  const cleaned = word.toLowerCase().replace(/[.]/g, "");
  return UNITS[cleaned] ?? null;
}

/**
 * Parse an ingredient line.
 *
 * Handles the leading form most recipes use ("300 g bread flour") and the
 * trailing form some sites and imports produce ("Bread flour, 300 g"). Anything
 * else comes back unparsed rather than guessed at.
 */
export function parseIngredient(raw: string): ParsedIngredient {
  const original = raw.trim();
  if (!original) return { name: "", quantity: null, unit: null };

  const leading = parseLeading(original);
  if (leading) return leading;

  const trailing = parseTrailing(original);
  if (trailing) return trailing;

  return { name: original, quantity: null, unit: null };
}

/** "300 g bread flour", "2 eggs", "1 1/2 cups flour", "300g flour". */
function parseLeading(text: string): ParsedIngredient | null {
  // Split a glued number+unit ("300g") so the tokeniser sees two words.
  const spaced = text.replace(
    /^(\d+(?:[.,]\d+)?(?:\s+\d+\/\d+)?|\d*[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])([a-zA-Z])/,
    "$1 $2",
  );
  const tokens = spaced.split(/\s+/);
  if (tokens.length < 2) return null;

  // The amount may span two tokens ("1 1/2").
  let amount = parseAmount(`${tokens[0]} ${tokens[1]}`);
  let consumed = 2;
  if (amount === null) {
    amount = parseAmount(tokens[0]!);
    consumed = 1;
  }
  if (amount === null) return null;

  let unit: string | null = null;
  const unitCandidate = tokens[consumed];
  if (unitCandidate) {
    const matched = matchUnit(unitCandidate);
    if (matched) {
      unit = matched;
      consumed += 1;
      // "fl oz" is two words.
      if (matched === "fl oz" && tokens[consumed]?.toLowerCase().startsWith("oz")) {
        consumed += 1;
      }
    }
  }

  const name = tokens.slice(consumed).join(" ").replace(/^of\s+/i, "").trim();
  // A number with nothing after it isn't an ingredient — leave the line alone
  // rather than producing a nameless row.
  if (!name) return null;

  return { name, quantity: amount, unit };
}

/** "Bread flour, 300 g" — the shape the current importers produce. */
function parseTrailing(text: string): ParsedIngredient | null {
  const match = text.match(
    /^(.*?),\s*(\d+(?:[.,]\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+|\d*[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])\s*([a-zA-Z]+)?\s*$/,
  );
  if (!match) return null;

  const [, name, amountText, unitWord] = match;
  const amount = parseAmount(amountText!);
  if (amount === null) return null;
  if (!name?.trim()) return null;

  // A trailing word that isn't a unit means this was never a quantity —
  // "Onion, 2 diced" should be left alone.
  if (unitWord && !matchUnit(unitWord)) return null;

  return {
    name: name.trim(),
    quantity: amount,
    unit: unitWord ? matchUnit(unitWord) : null,
  };
}
