/**
 * Recipe import agent — fetches a URL and extracts recipe data via Schema.org
 * structured data (application/ld+json). Covers the vast majority of recipe
 * sites without needing an AI call.
 *
 * A Claude fallback for non-standard sites can be layered on top later.
 */

import type { CreateRecipeInput } from "@souschef/shared";

// ── Schema.org types ───────────────────────────────────────────────────────────

type SchemaHowToStep = {
  "@type"?: string;
  text?: string;
  name?: string;
};

type SchemaRecipe = {
  "@type"?: string;
  name?: string;
  description?: string;
  recipeIngredient?: string[];
  recipeInstructions?: string | string[] | SchemaHowToStep[];
  recipeYield?: string | string[] | number;
  prepTime?: string;
  cookTime?: string;
  recipeCuisine?: string | string[];
  keywords?: string | string[];
  image?: string | { url: string } | Array<string | { url: string }>;
};

// ── Parsing helpers ────────────────────────────────────────────────────────────

/** Parse ISO 8601 duration (PT30M, PT1H, PT1H30M) → minutes */
function parseDuration(iso?: string): number | null {
  if (!iso) return null;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!match) return null;
  const hours = parseInt(match[1] ?? "0", 10);
  const minutes = parseInt(match[2] ?? "0", 10);
  const total = hours * 60 + minutes;
  return total > 0 ? total : null;
}

/** Parse servings from various formats: "4", "4 servings", "4-6" → 4 */
function parseServings(raw?: string | string[] | number): number {
  if (raw == null) return 4;
  const str = Array.isArray(raw) ? (raw[0] ?? "4") : String(raw);
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : 4;
}

/** Normalise instructions to an array of strings */
function parseInstructions(
  raw?: string | string[] | SchemaHowToStep[],
): string[] {
  if (!raw) return [];

  if (typeof raw === "string") {
    return raw
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return (raw as Array<string | SchemaHowToStep>)
    .map((item) => {
      if (typeof item === "string") return item.trim();
      return (item.text ?? item.name ?? "").trim();
    })
    .filter(Boolean);
}

/** Extract the first usable image URL */
function parseImage(
  image?: string | { url: string } | Array<string | { url: string }>,
): string | null {
  if (!image) return null;
  if (typeof image === "string") return image;
  if (Array.isArray(image)) {
    const first = image[0];
    if (!first) return null;
    return typeof first === "string" ? first : (first.url ?? null);
  }
  return image.url ?? null;
}

/** Extract the first string from a string | string[] field */
function firstString(value?: string | string[]): string | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

// ── Schema.org extraction ──────────────────────────────────────────────────────

function findSchemaRecipe(html: string): SchemaRecipe | null {
  const scriptRegex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match: RegExpExecArray | null;
  while ((match = scriptRegex.exec(html)) !== null) {
    const raw = match[1];
    if (!raw) continue;
    try {
      const json: unknown = JSON.parse(raw);

      if (!json || typeof json !== "object") continue;

      // Array of schema objects
      if (Array.isArray(json)) {
        const found = (json as SchemaRecipe[]).find(
          (item) => item["@type"] === "Recipe",
        );
        if (found) return found;
        continue;
      }

      const obj = json as Record<string, unknown>;

      // Direct Recipe object
      if (obj["@type"] === "Recipe") {
        return obj as SchemaRecipe;
      }

      // @graph wrapper (common on many recipe sites)
      if ("@graph" in obj && Array.isArray(obj["@graph"])) {
        const found = (obj["@graph"] as SchemaRecipe[]).find(
          (item) => item["@type"] === "Recipe",
        );
        if (found) return found;
      }
    } catch {
      // Malformed JSON block — skip
    }
  }

  return null;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export type ImportResult =
  | { ok: true; recipe: CreateRecipeInput }
  | { ok: false; error: string };

export type FetchResult =
  | { ok: true; html: string }
  | { ok: false; error: string };

/** Validates and fetches a URL, returning the raw HTML. */
export async function fetchPageHtml(url: string): Promise<FetchResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: "Invalid URL" };
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { ok: false, error: "URL must use http or https" };
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; sousChef recipe importer; +https://souschef.app)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return { ok: false, error: `Failed to fetch URL (HTTP ${response.status})` };
    }

    return { ok: true, html: await response.text() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to fetch URL" };
  }
}

/** Tries to extract a recipe from pre-fetched HTML using Schema.org structured data. */
export function parseRecipeFromHtml(
  url: string,
  html: string,
): ImportResult {
  const schema = findSchemaRecipe(html);

  if (!schema?.name) {
    return {
      ok: false,
      error: "No recipe data found on this page. The site may not support structured data.",
    };
  }

  const instructions = parseInstructions(schema.recipeInstructions);

  const recipe: CreateRecipeInput = {
    title: schema.name.trim(),
    description: schema.description?.trim() ?? null,
    imageUrl: parseImage(schema.image),
    servings: parseServings(schema.recipeYield),
    prepTimeMinutes: parseDuration(schema.prepTime),
    cookTimeMinutes: parseDuration(schema.cookTime),
    cuisine: firstString(schema.recipeCuisine),
    sourceUrl: url,
    isPublic: false,

    // Ingredient strings go into name field — structured quantity/unit parsing
    // can be added later via the scaling agent
    ingredients: (schema.recipeIngredient ?? []).map((name, idx) => ({
      name: name.trim(),
      orderIndex: idx,
    })),

    steps: instructions.map((instruction, idx) => ({
      stepNumber: idx + 1,
      instruction,
    })),

    tags: schema.keywords
      ? typeof schema.keywords === "string"
        ? schema.keywords
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean)
        : schema.keywords
      : [],
  };

  return { ok: true, recipe };
}

/** Fetches a URL and tries to extract a recipe via Schema.org structured data. */
export async function importRecipeFromUrl(url: string): Promise<ImportResult> {
  const fetched = await fetchPageHtml(url);
  if (!fetched.ok) return fetched;
  return parseRecipeFromHtml(url, fetched.html);
}
