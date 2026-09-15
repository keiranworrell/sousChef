import { z } from "zod";

/**
 * The sousChef recipe interchange format.
 *
 * This is the contract between export and import, and the thing that makes
 * "your recipes are yours" true rather than a slogan. Two rules govern it:
 *
 * 1. It is a *format*, not a dump of our tables. Database ids, user ids and
 *    internal flags are not here. A file full of our primary keys is not
 *    "commonly used and machine-readable" in any useful sense, and it cannot be
 *    imported into a different account without collisions.
 *
 * 2. Order is carried by array position, never by an index field. An export
 *    that writes both can contradict itself, and then there is no right answer
 *    about which one the importer should believe.
 *
 * Attribution travels with the recipe. `sourceUrl` and `sourceModified` are
 * part of the format, so a recipe that came from someone else's site still says
 * so after a round trip. Stripping them would make an imported recipe look like
 * the user's own work, which is both untrue and the wrong default for a product
 * that encourages importing from the web.
 */
export const RECIPE_INTERCHANGE_FORMAT = "souschef-recipe-v1";

/** The full-account export wrapper, which embeds interchange recipes. */
export const USER_EXPORT_FORMAT = "souschef-export-v1";

// ── Schemas ───────────────────────────────────────────────────────────────────

export const InterchangeIngredientSchema = z.object({
  name: z.string().min(1).max(500),
  quantity: z.number().positive().nullable().optional(),
  unit: z.string().max(100).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const InterchangeStepSchema = z.object({
  instruction: z.string().min(1).max(10000),
  timerSeconds: z.number().int().nonnegative().nullable().optional(),
  imageUrl: z.string().max(2000).nullable().optional(),
});

export const InterchangeRecipeSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).nullable().optional(),
  imageUrl: z.string().max(2000).nullable().optional(),
  servings: z.number().int().positive().max(1000).optional(),
  prepTimeMinutes: z.number().int().nonnegative().nullable().optional(),
  cookTimeMinutes: z.number().int().nonnegative().nullable().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).nullable().optional(),
  cuisine: z.string().max(200).nullable().optional(),
  sourceUrl: z.string().max(2000).nullable().optional(),
  sourceModified: z.boolean().optional(),
  tags: z.array(z.string().min(1).max(100)).optional(),
  ingredients: z.array(InterchangeIngredientSchema).optional(),
  steps: z.array(InterchangeStepSchema).optional(),
  /**
   * Informational only. The importer does not restore these — an imported
   * recipe was created in this account today, and claiming otherwise would put
   * a lie in the audit trail. They are exported so a human reading the file can
   * see when the original was written.
   */
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

/**
 * A recipes-only file. Deliberately permissive about `format`: a file
 * hand-assembled by a user or produced by a future version should still import
 * if its recipes parse, rather than being rejected on a version string.
 */
export const RecipeInterchangeFileSchema = z.object({
  format: z.string().optional(),
  exportedAt: z.string().optional(),
  recipes: z.array(InterchangeRecipeSchema),
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type InterchangeIngredient = z.infer<typeof InterchangeIngredientSchema>;
export type InterchangeStep = z.infer<typeof InterchangeStepSchema>;
export type InterchangeRecipe = z.infer<typeof InterchangeRecipeSchema>;
export type RecipeInterchangeFile = z.infer<typeof RecipeInterchangeFileSchema>;

// ── Parsing ───────────────────────────────────────────────────────────────────

export type ParsedImport = {
  recipes: InterchangeRecipe[];
  /**
   * Recipes present in the file that failed validation, with the reason. These
   * are reported rather than silently dropped: an import that says "12 imported"
   * when the file held 15 has lost the user three recipes without telling them.
   */
  rejected: { index: number; title: string | null; reason: string }[];
};

function describeIssue(err: z.ZodError): string {
  const issue = err.issues[0];
  if (!issue) return "Invalid recipe";
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

/**
 * Pull recipes out of whatever the user handed us.
 *
 * Accepts, in order of how likely the user is to have it:
 * - a full account export (`{ recipes: [...] }` alongside everything else)
 * - a recipes-only interchange file
 * - a bare array of recipes
 * - a single recipe object
 *
 * Being liberal here is the point. Someone exporting their data and immediately
 * importing it should not have to know which of those four shapes they have,
 * and the top-level shape carries no information the recipes don't.
 *
 * Each recipe is validated independently so one malformed entry costs the user
 * that entry, not the whole file.
 */
export function parseRecipeImport(raw: unknown): ParsedImport | { error: string } {
  let candidates: unknown[];

  if (Array.isArray(raw)) {
    candidates = raw;
  } else if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj["recipes"])) {
      candidates = obj["recipes"];
    } else if (typeof obj["title"] === "string") {
      candidates = [obj];
    } else {
      return {
        error:
          "This file doesn't contain any recipes. Expected a sousChef export, " +
          "or a file with a \"recipes\" list.",
      };
    }
  } else {
    return { error: "This file isn't valid JSON object data." };
  }

  const recipes: InterchangeRecipe[] = [];
  const rejected: ParsedImport["rejected"] = [];

  candidates.forEach((candidate, index) => {
    const result = InterchangeRecipeSchema.safeParse(candidate);
    if (result.success) {
      recipes.push(result.data);
      return;
    }
    const title =
      candidate && typeof candidate === "object" &&
      typeof (candidate as Record<string, unknown>)["title"] === "string"
        ? ((candidate as Record<string, unknown>)["title"] as string)
        : null;
    rejected.push({ index, title, reason: describeIssue(result.error) });
  });

  return { recipes, rejected };
}
