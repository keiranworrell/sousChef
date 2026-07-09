/**
 * Predictive tag suggestions based on ingredient names.
 *
 * Rules are intentionally conservative — we only suggest a dietary tag when
 * we are confident the recipe qualifies. False negatives (missing a tag) are
 * preferable to false positives (wrongly labelling a recipe vegan when it
 * contains chicken).
 *
 * Supported tags: "vegetarian", "vegan", "gluten-free", "dairy-free"
 */

// ── Keyword lists ─────────────────────────────────────────────────────────────

/** Meat ingredients that make a recipe non-vegetarian and non-vegan. */
const MEAT_KEYWORDS: string[] = [
  "beef",
  "chicken",
  "lamb",
  "pork",
  "turkey",
  "duck",
  "veal",
  "venison",
  "rabbit",
  "goat",
  "mutton",
  "bison",
  "bacon",
  "ham",
  "prosciutto",
  "pancetta",
  "lardons",
  "salami",
  "chorizo",
  "pepperoni",
  "sausage",
  "mince",
  "minced",
  "luncheon",
  "spam",
  "liver",
  "kidney",
  "heart",
  "offal",
  "suet",
  "dripping",
  "lard",
  "gelatin",
  "gelatine",
];

/** Seafood ingredients that make a recipe non-vegetarian and non-vegan. */
const SEAFOOD_KEYWORDS: string[] = [
  "salmon",
  "cod",
  "tuna",
  "mackerel",
  "trout",
  "haddock",
  "sea bass",
  "tilapia",
  "halibut",
  "swordfish",
  "sardine",
  "anchovy",
  "anchovies",
  "herring",
  "pollock",
  "plaice",
  "sole",
  "snapper",
  "shrimp",
  "prawn",
  "lobster",
  "crab",
  "scallop",
  "mussel",
  "clam",
  "oyster",
  "squid",
  "octopus",
  "calamari",
  "crayfish",
  "langoustine",
  "fish sauce",
  "fish stock",
  "fish paste",
  "worcestershire sauce",
];

/** Dairy ingredients that make a recipe non-vegan and not dairy-free. */
const DAIRY_KEYWORDS: string[] = [
  "butter",
  "milk",
  "cream",
  "cheese",
  "yoghurt",
  "yogurt",
  "ghee",
  "whey",
  "casein",
  "lactose",
  "parmesan",
  "mozzarella",
  "cheddar",
  "brie",
  "camembert",
  "ricotta",
  "mascarpone",
  "feta",
  "halloumi",
  "gruyère",
  "gruyere",
  "emmental",
  "pecorino",
  "stilton",
  "gorgonzola",
  "crème fraîche",
  "creme fraiche",
  "buttermilk",
  "sour cream",
  "clotted cream",
  "condensed milk",
  "evaporated milk",
  "skyr",
  "kefir",
  "quark",
];

/** Egg ingredients that make a recipe non-vegan. */
const EGG_KEYWORDS: string[] = ["egg", "eggs", "mayonnaise", "mayo", "aioli"];

/**
 * Gluten-free flour types — these contain the word "flour" but are safe.
 * Used to distinguish them from wheat flour.
 */
const GF_FLOUR_MODIFIERS: string[] = [
  "almond",
  "rice",
  "oat",
  "coconut",
  "tapioca",
  "chickpea",
  "cassava",
  "gram",
  "buckwheat",
  "cornflour",
  "corn flour",
  "potato",
  "gluten-free",
  "gluten free",
  "arrowroot",
  "teff",
  "sorghum",
];

/** Ingredients that contain gluten (wheat-based or barley/rye). */
const GLUTEN_KEYWORDS: string[] = [
  "pasta",
  "noodle",
  "couscous",
  "bulgur",
  "barley",
  "rye",
  "semolina",
  "spelt",
  "panko",
  "breadcrumb",
  "crouton",
  "pita",
  "pitta",
  "tortilla",
  "baguette",
  "brioche",
  "sourdough",
  "soy sauce",
  "teriyaki sauce",
  "hoisin",
  "beer",
  "ale",
  "stout",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalisedNames(ingredientNames: string[]): string[] {
  return ingredientNames.map((n) => n.toLowerCase().trim());
}

function anyMatch(names: string[], keywords: string[]): boolean {
  return names.some((name) => keywords.some((kw) => name.includes(kw)));
}

/** Plant-based modifiers that precede dairy-sounding words and make them non-dairy. */
const PLANT_MILK_PREFIXES: string[] = [
  "coconut",
  "almond",
  "oat",
  "soy",
  "soya",
  "rice",
  "cashew",
  "hemp",
  "macadamia",
  "hazelnut",
  "pea",
  "flax",
  "quinoa",
];

function hasDairy(names: string[]): boolean {
  return names.some((name) => {
    // Explicit dairy-free label
    if (name.includes("dairy-free") || name.includes("dairy free")) return false;
    // Plant-based milk/cream/cheese alternatives
    if (
      (name.includes("milk") ||
        name.includes("cream") ||
        name.includes("cheese") ||
        name.includes("butter") ||
        name.includes("yoghurt") ||
        name.includes("yogurt")) &&
      PLANT_MILK_PREFIXES.some((prefix) => name.includes(prefix))
    ) {
      return false;
    }
    return DAIRY_KEYWORDS.some((kw) => name.includes(kw));
  });
}

function hasEggs(names: string[]): boolean {
  return names.some((name) => {
    if (name.includes("dairy-free") || name.includes("egg-free")) return false;
    return EGG_KEYWORDS.some((kw) => name.includes(kw));
  });
}

function hasGluten(names: string[]): boolean {
  return names.some((name) => {
    // Handle "flour" separately: safe if it's a GF flour type
    if (name.includes("flour")) {
      const isGFFLour = GF_FLOUR_MODIFIERS.some((mod) => name.includes(mod));
      if (!isGFFLour) return true; // plain/bread/all-purpose flour etc.
    }
    // Skip known GF pasta/noodle variants
    if (
      (name.includes("pasta") || name.includes("noodle")) &&
      (name.includes("rice") ||
        name.includes("gluten-free") ||
        name.includes("chickpea") ||
        name.includes("lentil") ||
        name.includes("glass") ||
        name.includes("cellophane"))
    ) {
      return false;
    }
    // Skip GF soy sauce variants
    if (
      name.includes("soy sauce") &&
      (name.includes("tamari") || name.includes("gluten-free"))
    ) {
      return false;
    }
    return GLUTEN_KEYWORDS.some((kw) => name.includes(kw));
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Given a list of ingredient names, return dietary tags that can be
 * confidently suggested. Only produces tags; never removes existing ones.
 *
 * Requires at least 2 non-empty ingredients before making any suggestions,
 * to avoid tagging an incomplete recipe.
 *
 * @param ingredientNames - Raw ingredient name strings (e.g. ["chicken breast", "garlic"])
 * @returns Array of suggested tag strings
 */
export function predictTags(ingredientNames: string[]): string[] {
  const filled = ingredientNames.filter((n) => n.trim().length > 0);
  if (filled.length < 2) return [];

  const names = normalisedNames(filled);

  const hasMeat = anyMatch(names, MEAT_KEYWORDS);
  const hasSeafood = anyMatch(names, SEAFOOD_KEYWORDS);
  const hasAnimalFlesh = hasMeat || hasSeafood;
  const hasAnimalProducts = hasDairy(names) || hasEggs(names);

  const tags: string[] = [];

  // Vegetarian: no meat or seafood
  if (!hasAnimalFlesh) {
    tags.push("vegetarian");
  }

  // Vegan: no meat, seafood, dairy, or eggs
  if (!hasAnimalFlesh && !hasAnimalProducts) {
    tags.push("vegan");
  }

  // Dairy-free: no dairy (meat is fine)
  if (!hasDairy(names)) {
    tags.push("dairy-free");
  }

  // Gluten-free: no gluten-containing ingredients
  if (!hasGluten(names)) {
    tags.push("gluten-free");
  }

  return tags;
}
