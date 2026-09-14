/**
 * Canonicalises an ingredient name for the purpose of combining shopping list
 * entries that refer to the same thing.
 *
 * Unit conversion was never the main obstacle to a usable shopping list — that
 * already works. The duplicates come from names: "salt" and "salt, a sprinkle"
 * are the same purchase written two ways, and no amount of unit maths will
 * merge them.
 *
 * Two kinds of mismatch, handled differently:
 *
 *   1. Lexical — "salt, a sprinkle", "onion (finely chopped)", "Onions".
 *      These are the same word dressed up, and are stripped mechanically below.
 *
 *   2. Semantic — "mince" and "93/7 ground beef". These share no characters, so
 *      no amount of string processing will connect them. They need the synonym
 *      table, which is necessarily a curated, incomplete list.
 *
 * The output is a matching key, not a display name. Whatever the user typed is
 * what they should see; this only decides what merges with what.
 */

/**
 * Words that describe how an ingredient was prepared rather than what it is.
 *
 * Deliberately conservative. Anything that changes what you would actually buy
 * is excluded: "ground" (ground beef is not beef), "dried" (dried basil is not
 * fresh basil), "smoked", "sun-dried", "frozen". Getting this wrong merges two
 * genuinely different shopping items, which is worse than leaving a duplicate.
 */
const PREPARATION_WORDS = new Set([
  "chopped", "finely", "roughly", "diced", "sliced", "thinly", "minced",
  "grated", "crushed", "peeled", "halved", "quartered", "beaten", "melted",
  "softened", "cubed", "shredded", "torn", "trimmed", "rinsed", "drained",
  "large", "small", "medium", "ripe",
]);

/**
 * Canonical forms for ingredients that go by more than one name.
 *
 * Mostly UK/US pairs, since recipes get imported from American sites and then
 * sit alongside British ones in the same plan. Canonical side is UK, matching
 * where the app is used.
 *
 * This list will never be complete — it covers what's predictable. The long
 * tail belongs to a manual "merge these" action on the list itself rather than
 * an ever-growing table nobody maintains.
 */
const SYNONYMS: Record<string, string> = {
  // Meat
  "ground beef": "beef mince",
  "minced beef": "beef mince",
  "minced pork": "pork mince",
  "minced lamb": "lamb mince",
  "minced turkey": "turkey mince",
  "minced chicken": "chicken mince",
  "mince": "beef mince",
  "hamburger meat": "beef mince",
  "ground pork": "pork mince",
  "ground lamb": "lamb mince",
  "ground turkey": "turkey mince",
  "ground chicken": "chicken mince",
  "shrimp": "prawn",
  "shrimps": "prawn",
  "prawns": "prawn",

  // Vegetables and herbs
  "cilantro": "coriander",
  "eggplant": "aubergine",
  "zucchini": "courgette",
  "arugula": "rocket",
  "scallion": "spring onion",
  "green onion": "spring onion",
  "garbanzo bean": "chickpea",
  "garbanzo": "chickpea",
  "bell pepper": "pepper",
  "capsicum": "pepper",
  "romaine": "cos lettuce",
  "rutabaga": "swede",
  "snow pea": "mangetout",
  "fava bean": "broad bean",
  "beet": "beetroot",

  // Baking and store cupboard
  "all purpose flour": "plain flour",
  "all-purpose flour": "plain flour",
  "ap flour": "plain flour",
  "self rising flour": "self-raising flour",
  "confectioners sugar": "icing sugar",
  "powdered sugar": "icing sugar",
  "superfine sugar": "caster sugar",
  "light brown sugar": "soft brown sugar",
  "baking soda": "bicarbonate of soda",
  "cornstarch": "cornflour",
  "golden raisin": "sultana",

  // Dairy
  "heavy cream": "double cream",
  "heavy whipping cream": "double cream",
  "whipping cream": "double cream",
  "light cream": "single cream",
  "half and half": "single cream",
};

/**
 * Plurals that don't follow the usual rules, or that the rules would mangle.
 * Words ending in -ss, -us, -is are handled by the rule and aren't listed.
 */
const IRREGULAR_PLURALS: Record<string, string> = {
  leaves: "leaf",
  loaves: "loaf",
  knives: "knife",
  halves: "half",
  wolves: "wolf",
  calves: "calf",
  potatoes: "potato",
  tomatoes: "tomato",
  mangoes: "mango",
  chillies: "chilli",
  chilies: "chilli",
  anchovies: "anchovy",
  berries: "berry",
  cherries: "cherry",
  geese: "goose",
  feet: "foot",
  teeth: "tooth",
};

/**
 * Words that end in "s" but are already singular. Stripping the "s" would
 * produce nonsense and, worse, would stop them matching themselves.
 */
const NEVER_SINGULARISE = new Set([
  "molasses", "hummus", "couscous", "asparagus", "watercress", "cress",
  "grass", "bass", "swiss", "greens", "oats", "chives", "capers", "grits",
  "sprouts", "noodles", "oreos", "cornflakes",
]);

function singularise(word: string): string {
  if (NEVER_SINGULARISE.has(word)) return word;
  const irregular = IRREGULAR_PLURALS[word];
  if (irregular) return irregular;

  if (word.length <= 3) return word;
  // -ss, -us, -is are singular endings, not plurals (glass, hummus, basis)
  if (/(ss|us|is)$/.test(word)) return word;
  if (/ies$/.test(word) && word.length > 4) return `${word.slice(0, -3)}y`;
  if (/(ch|sh|x|z|o)es$/.test(word)) return word.slice(0, -2);
  if (/s$/.test(word)) return word.slice(0, -1);
  return word;
}

/**
 * Reduces a raw ingredient name to a key used only for matching.
 *
 * Returns an empty string if nothing meaningful survives, which the caller
 * should treat as "don't merge this with anything" rather than as a group.
 */
export function normaliseIngredientName(raw: string): string {
  let s = raw.toLowerCase().trim();

  // "flour (plain)" → "flour". Parentheticals are almost always clarification
  // or preparation, never the identity of the thing.
  s = s.replace(/\([^)]*\)/g, " ");

  // "salt, a sprinkle" → "salt". Importers frequently dump the quantity
  // descriptor into the name field after a comma, which is the single most
  // common cause of duplicate rows.
  const comma = s.indexOf(",");
  if (comma > 0) s = s.slice(0, comma);

  // "93/7 ground beef" → "ground beef". Leading numbers, fractions, ratios and
  // percentages describe the product, not its name.
  s = s.replace(/^[\d\s./%-]+/, "");

  // Drop anything that isn't a letter, space or hyphen: trailing asterisks from
  // footnote markers, stray punctuation from OCR imports.
  s = s.replace(/[^a-z\s-]/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return "";

  // Synonym lookup before singularising, so multi-word entries like
  // "garbanzo beans" get a chance to match on the plural form the table uses.
  const direct = SYNONYMS[s];
  if (direct) return direct;

  const words = s.split(" ").filter((w) => !PREPARATION_WORDS.has(w));
  // Everything was a preparation word ("finely chopped") — no identity left, so
  // fall back to the original rather than returning nothing.
  const kept = words.length > 0 ? words : s.split(" ");

  const singular = kept.map(singularise).join(" ");
  return SYNONYMS[singular] ?? singular;
}
