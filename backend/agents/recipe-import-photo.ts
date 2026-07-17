/**
 * Recipe-from-photo AI agent.
 *
 * Accepts one or more base64-encoded images of a recipe (cookbook page,
 * recipe card, magazine clipping, etc.) and extracts structured recipe data
 * using Claude's vision capabilities.
 *
 * Multiple photos are combined into a single Claude message so that a recipe
 * spanning several pages is reconstructed as one coherent output.
 *
 * The caller is responsible for premium-gating this function.
 */

import { z } from "zod";
import { getAnthropicClient } from "../lib/anthropic-client";
import type { ImportResult } from "./recipe-import";
import type { CreateRecipeInput } from "@souschef/shared";

// ── System prompt ──────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a recipe extraction assistant. You will be shown one or more photos of a recipe — from a cookbook, magazine, recipe card, handwritten note, or similar. Extract the complete recipe from all the photos combined and return it as a single JSON object.

If multiple photos are provided, they likely show different pages or sections of the same recipe — combine them into one complete recipe.

Return ONLY a valid JSON object — no markdown fences, no preamble, no explanation. The JSON must exactly match this structure:

{
  "title": "string (required)",
  "description": "string or null",
  "servings": number or null,
  "prepTimeMinutes": number or null,
  "cookTimeMinutes": number or null,
  "difficulty": "easy" | "medium" | "hard" | null,
  "cuisine": "string or null",
  "ingredients": [
    {
      "name": "string",
      "quantity": number or null,
      "unit": "string or null",
      "notes": "string or null",
      "orderIndex": number
    }
  ],
  "steps": [
    {
      "stepNumber": number,
      "instruction": "string"
    }
  ],
  "tags": ["string"]
}

Rules:
- title is required. If the images do not contain a recipe, return {"error": "No recipe found in the provided images"}.
- ingredients must be an array. Extract quantity and unit where clearly identifiable; leave null otherwise.
- steps must be an ordered array of instructions.
- tags should be a short descriptive list (cuisine, dietary, occasion). Maximum 8.
- difficulty: infer from context if not stated. Few simple steps = easy; complex techniques = hard; otherwise medium.
- All time values must be in minutes as integers.
- Never include keys not listed above.`;

// ── Response schema ────────────────────────────────────────────────────────────

const PhotoRecipeResponseSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  servings: z.number().int().positive().nullable().optional(),
  prepTimeMinutes: z.number().int().nonnegative().nullable().optional(),
  cookTimeMinutes: z.number().int().nonnegative().nullable().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).nullable().optional(),
  cuisine: z.string().nullable().optional(),
  ingredients: z.array(
    z.object({
      name: z.string().min(1),
      quantity: z.number().positive().nullable().optional(),
      unit: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
      orderIndex: z.number().int().nonnegative(),
    }),
  ),
  steps: z.array(
    z.object({
      stepNumber: z.number().int().positive(),
      instruction: z.string().min(1),
    }),
  ),
  tags: z.array(z.string().min(1)).optional().default([]),
});

const ErrorResponseSchema = z.object({ error: z.string() });

// ── Allowed MIME types ────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

function isAllowedMimeType(value: string): value is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}

// ── Public API ─────────────────────────────────────────────────────────────────

export type PhotoImportInput = {
  /** Base64-encoded image data. May include a data-URL prefix — it will be stripped. */
  images: string[];
  /** MIME type for each image, parallel to images array. Defaults to image/jpeg. */
  mimeTypes: string[];
};

/**
 * Extracts a recipe from one or more photos using Claude's vision model.
 */
export async function importRecipeFromPhotos(
  input: PhotoImportInput,
): Promise<ImportResult> {
  const { images, mimeTypes } = input;

  if (images.length === 0) {
    return { ok: false, error: "No images provided." };
  }

  if (images.length > 10) {
    return { ok: false, error: "Too many images. Please provide at most 10 photos." };
  }

  let client;
  try {
    client = await getAnthropicClient();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "AI service unavailable" };
  }

  // Build image content blocks — strip data-URL prefix if present
  const imageBlocks = images.map((raw, idx) => {
    const data = raw.replace(/^data:[^;]+;base64,/, "");
    const mimeType = mimeTypes[idx] ?? "image/jpeg";
    const mediaType: AllowedMimeType = isAllowedMimeType(mimeType) ? mimeType : "image/jpeg";
    return {
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: mediaType,
        data,
      },
    };
  });

  const userContent = [
    ...imageBlocks,
    {
      type: "text" as const,
      text:
        images.length === 1
          ? "Extract the recipe from this photo."
          : `Extract the complete recipe from these ${images.length} photos. They may show different pages of the same recipe — combine them into one.`,
    },
  ];

  let rawResponse: string;
  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    const block = message.content[0];
    if (!block || block.type !== "text") {
      return { ok: false, error: "Unexpected response from AI service." };
    }
    rawResponse = block.text.trim();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "AI extraction failed." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawResponse);
  } catch {
    return { ok: false, error: "AI returned an unexpected response format." };
  }

  const errorCheck = ErrorResponseSchema.safeParse(parsed);
  if (errorCheck.success) {
    return { ok: false, error: errorCheck.data.error };
  }

  const result = PhotoRecipeResponseSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: "AI returned incomplete recipe data." };
  }

  const data = result.data;

  const recipe: CreateRecipeInput = {
    title: data.title,
    description: data.description ?? null,
    imageUrl: null,
    servings: data.servings ?? 4,
    prepTimeMinutes: data.prepTimeMinutes ?? null,
    cookTimeMinutes: data.cookTimeMinutes ?? null,
    difficulty: data.difficulty ?? null,
    cuisine: data.cuisine ?? null,
    isPublic: false,
    sourceUrl: null,
    ingredients: data.ingredients.map((ing, idx) => ({
      name: ing.name,
      quantity: ing.quantity ?? null,
      unit: ing.unit ?? null,
      notes: ing.notes ?? null,
      orderIndex: ing.orderIndex ?? idx,
    })),
    steps: data.steps.map((step) => ({
      stepNumber: step.stepNumber,
      instruction: step.instruction,
    })),
    tags: data.tags ?? [],
  };

  return { ok: true, recipe };
}
