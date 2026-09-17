/**
 * Recipe import agent — fetches a URL and extracts recipe data via Schema.org
 * structured data (application/ld+json). Covers the vast majority of recipe
 * sites without needing an AI call.
 *
 * A Claude fallback for non-standard sites can be layered on top later.
 */

import type { CreateRecipeInput } from "@souschef/shared";
import { parseIngredient } from "@souschef/shared";

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

/**
 * Turns a fetch failure into something a cook can act on.
 *
 * "Failed to fetch URL (HTTP 403)" is accurate and useless. It tells the reader
 * nothing about whose fault it is, whether trying again would help, or what else
 * they could do — and the answers differ sharply by status. A paywall is
 * permanent and has a workaround; a 503 is temporary and has none; a 404 means
 * check the link. Collapsing all of them into one sentence with a number in it
 * makes every case look like a bug in sousChef.
 *
 * Pure and exported so the mapping can be tested without a network.
 */
export function importFailureMessage(
  cause: { kind: "http"; status: number } | { kind: "network"; error: unknown },
  host: string,
): string {
  const site = host || "that site";

  if (cause.kind === "http") {
    const { status } = cause;

    // 401/403 on a recipe page is nearly always a paywall or a bot check rather
    // than a genuine permission error, and the honest advice is the same either
    // way: we cannot read the page, but you can.
    if (status === 401 || status === 403) {
      return (
        `${site} wouldn't let us read that page — it's likely behind a paywall or ` +
        `blocking automated readers. If you can see the recipe yourself, copy the ` +
        `text and use "Paste text" instead.`
      );
    }
    if (status === 404 || status === 410) {
      return `There's no page at that address on ${site}. Check the link — the recipe may have been moved or taken down.`;
    }
    if (status === 429) {
      return `${site} is asking us to slow down. Wait a few minutes and try again.`;
    }
    if (status === 451) {
      return `${site} has blocked that page for legal reasons in this region.`;
    }
    if (status >= 500) {
      return `${site} is having problems at the moment. This isn't your link — try again in a little while.`;
    }
    return `${site} refused the request (HTTP ${status}). If the page opens in your browser, copy the text and use "Paste text" instead.`;
  }

  const err = cause.error;
  const name = err instanceof Error ? err.name : "";
  const message = err instanceof Error ? err.message : "";

  // AbortSignal.timeout rejects with a TimeoutError; some runtimes still report
  // AbortError. Both mean the same thing to the reader.
  if (name === "TimeoutError" || name === "AbortError") {
    return `${site} took too long to respond. It may be slow right now — try again, or paste the recipe text instead.`;
  }

  // Undici wraps DNS and connection failures; the cause code is the reliable
  // signal, the message text is not.
  const code =
    typeof err === "object" && err !== null && "cause" in err
      ? (err as { cause?: { code?: string } }).cause?.code
      : undefined;

  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return `We couldn't find ${site}. Check the address is right.`;
  }
  if (code === "ECONNREFUSED" || code === "ECONNRESET" || code === "EPIPE") {
    return `${site} closed the connection before we could read the page. Try again in a moment.`;
  }
  if (code?.startsWith("ERR_TLS") || code === "CERT_HAS_EXPIRED" || code === "DEPTH_ZERO_SELF_SIGNED_CERT") {
    return `${site} has a security certificate problem, so we didn't load it. That's a fault on their end.`;
  }

  return message
    ? `We couldn't reach ${site}. ${message}`
    : `We couldn't reach ${site}. Check the address and your connection, then try again.`;
}

/** Validates and fetches a URL, returning the raw HTML. */
export async function fetchPageHtml(url: string): Promise<FetchResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      ok: false,
      error:
        "That doesn't look like a web address. Paste the full link, including the https:// at the start.",
    };
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return {
      ok: false,
      error: `Recipes can only be imported from web pages, and that link is a ${parsed.protocol.replace(":", "")} address.`,
    };
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
      return {
        ok: false,
        error: importFailureMessage({ kind: "http", status: response.status }, parsed.hostname),
      };
    }

    return { ok: true, html: await response.text() };
  } catch (err) {
    return {
      ok: false,
      error: importFailureMessage({ kind: "network", error: err }, parsed.hostname),
    };
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

    // Parsed into quantity / unit / name rather than dumped whole into `name`.
    //
    // This used to store "300 g bread flour" as the name with a null quantity,
    // which reads fine on the recipe page and quietly breaks everything
    // downstream: scaling has nothing to scale, and the shopping list cannot
    // add two amounts of flour together because neither carries a number.
    //
    // parseIngredient is conservative — anything it can't confidently split
    // comes back whole, which is exactly the old behaviour, so this can only
    // improve on what was there.
    ingredients: (schema.recipeIngredient ?? []).map((line, idx) => {
      const parsed = parseIngredient(line);
      return {
        name: parsed.name,
        quantity: parsed.quantity,
        unit: parsed.unit,
        orderIndex: idx,
      };
    }),

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
