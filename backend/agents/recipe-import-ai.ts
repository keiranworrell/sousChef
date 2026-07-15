/**
 * AI recipe import agent — extracts structured recipe data from raw HTML using Claude.
 * Used as a fallback when Schema.org structured data is not present on the page.
 */

import { z } from "zod";
import { getAnthropicClient } from "../lib/anthropic-client";
import type { ImportResult } from "./recipe-import";
import type { CreateRecipeInput } from "@souschef/shared";

// ── System prompt ──────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a recipe extraction assistant. Your job is to extract recipe information from raw webpage text and return it as structured JSON.

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
      "name": "string (full ingredient string, e.g. '200g plain flour')",
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
- title is required. If you cannot find a recipe title, return {"error": "No recipe found on this page"}.
- ingredients must be an array. Each ingredient name should be the full ingredient string as written (e.g. "200g plain flour, sifted"). Extract quantity and unit where clearly identifiable, otherwise leave them null.
- steps must be an array of ordered instructions. Each instruction is a single step, not a sentence fragment.
- tags should be a short list of descriptive tags (cuisine, dietary, occasion). Maximum 8 tags.
- difficulty: guess from context if not stated. Simple recipes with few steps = easy; complex techniques = hard; otherwise medium.
- All time values must be in minutes as integers.
- Never include keys not listed above.`;

// ── Response schema ────────────────────────────────────────────────────────────

const AiRecipeResponseSchema = z.object({
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

const AiErrorResponseSchema = z.object({ error: z.string() });

// ── HTML → text ────────────────────────────────────────────────────────────────

/**
 * Strips HTML tags and collapses whitespace to produce plain text for the AI.
 * Also removes <script>, <style>, and <noscript> blocks entirely.
 */
function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|nav|header|footer)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 40_000); // Stay well within context limits
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Extracts a recipe from pre-fetched HTML using Claude as a fallback.
 * The caller is responsible for premium-gating this function.
 */
export async function importRecipeWithAi(
  url: string,
  html: string,
): Promise<ImportResult> {
  const text = htmlToText(html);

  if (text.length < 100) {
    return { ok: false, error: "Page content too short to extract a recipe from." };
  }

  let client;
  try {
    client = await getAnthropicClient();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "AI service unavailable" };
  }

  let rawResponse: string;
  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Extract the recipe from this webpage. URL: ${url}\n\nPage content:\n${text}`,
        },
      ],
    });

    const block = message.content[0];
    if (!block || block.type !== "text") {
      return { ok: false, error: "Unexpected response from AI service." };
    }
    rawResponse = block.text.trim();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "AI extraction failed" };
  }

  // Try to parse the response
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawResponse);
  } catch {
    return { ok: false, error: "AI returned an unexpected response format." };
  }

  // Check for an error response
  const errorCheck = AiErrorResponseSchema.safeParse(parsed);
  if (errorCheck.success) {
    return { ok: false, error: errorCheck.data.error };
  }

  // Validate the recipe response
  const result = AiRecipeResponseSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: "AI returned incomplete recipe data." };
  }

  const data = result.data;

  const recipe: CreateRecipeInput = {
    title: data.title,
    description: data.description ?? null,
    imageUrl: null, // AI doesn't reliably extract image URLs from text
    servings: data.servings ?? 4,
    prepTimeMinutes: data.prepTimeMinutes ?? null,
    cookTimeMinutes: data.cookTimeMinutes ?? null,
    difficulty: data.difficulty ?? null,
    cuisine: data.cuisine ?? null,
    isPublic: false,
    sourceUrl: url,
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
