/**
 * Multi-recipe cooking agent — interleaves the steps of several recipes into a
 * single timed plan.
 *
 * The governing constraint: **the model chooses order and timing, never words.**
 * It returns references to steps that already exist, and every reference is
 * checked against the real recipes before a plan is accepted. That matters more
 * here than in the import agents, because those produce a draft a human then
 * reads and edits, whereas this produces instructions someone follows while
 * holding a hot pan. A model that quietly changed "180°C" to "200°C", or
 * dropped the step where the sauce is seasoned, would not be caught by anyone.
 *
 * So the output is verifiable: a plan either accounts for exactly the steps
 * that exist, once each, or it is rejected. See validatePlan.
 */

import { z } from "zod";
import { getAnthropicClient } from "../lib/anthropic-client";
import type { CookPlan, CookPlanStep } from "../db/schema/cook-sessions";

// ── The recipes, as the agent sees them ────────────────────────────────────────

export type PlannableRecipe = {
  id: string;
  title: string;
  servings: number;
  steps: { stepNumber: number; instruction: string; timerSeconds: number | null }[];
};

// ── System prompt ──────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a kitchen timing assistant. You are given several recipes that someone wants to cook so they are all ready at the same time. Your job is to interleave their steps into one sensible order.

Return ONLY a valid JSON object — no markdown fences, no preamble, no explanation:

{
  "totalMinutes": number,
  "steps": [
    {
      "recipeId": "string — must be one of the recipe ids given to you",
      "stepNumber": number — must be a step number that exists in that recipe,
      "startOffsetMinutes": number — minutes from the start of cooking,
      "note": "string or null — a short reason this step sits here"
    }
  ]
}

Absolute rules:
- You MUST NOT write, reword, summarise or invent instruction text. You only reference steps that already exist, by recipeId and stepNumber.
- Every step of every recipe must appear exactly once. Do not drop steps you think are unimportant. Do not repeat steps.
- Steps within a single recipe must stay in their original relative order. You may interleave *between* recipes freely, but step 3 of a recipe can never come before step 2 of the same recipe.
- startOffsetMinutes must not decrease as the array progresses.

Guidance:
- Put long unattended work first — marinating, proving, reducing, roasting — so other work happens while it runs.
- Group steps that use the same equipment, and flag conflicts in the note (e.g. "oven is busy with the tray bake until 40 min").
- Aim for everything finishing together. Say so in the note for the final steps of each recipe.
- Keep notes short: one clause, no more. Most steps need no note at all — use null.
- Be honest in your timings. It is better to leave slack than to imply a precision you do not have.`;

// ── Response schema ────────────────────────────────────────────────────────────

const PlanResponseSchema = z.object({
  totalMinutes: z.number().nonnegative().max(2880),
  steps: z
    .array(
      z.object({
        recipeId: z.string().min(1),
        stepNumber: z.number().int().positive(),
        startOffsetMinutes: z.number().nonnegative().max(2880),
        note: z.string().max(200).nullable().optional(),
      }),
    )
    .min(1),
});

export type PlanResult =
  | { ok: true; plan: CookPlan }
  | { ok: false; error: string };

// ── Validation ─────────────────────────────────────────────────────────────────

export type ValidationFailure =
  | { kind: "unknown-recipe"; recipeId: string }
  | { kind: "unknown-step"; recipeId: string; stepNumber: number }
  | { kind: "duplicate-step"; recipeId: string; stepNumber: number }
  | { kind: "missing-steps"; count: number }
  | { kind: "out-of-order"; recipeId: string; stepNumber: number };

/**
 * Checks a proposed plan against the recipes it claims to be built from.
 *
 * Pure, and exported, because this is the promise the whole feature rests on:
 * that what the user is told to do is what their recipe actually says. A rule
 * that load-bearing should be testable without a database or a model.
 *
 * Returns the failures found rather than a boolean, so the caller can log what
 * the model got wrong rather than just that it did.
 */
export function validatePlan(
  proposed: { recipeId: string; stepNumber: number }[],
  recipes: PlannableRecipe[],
): ValidationFailure[] {
  const failures: ValidationFailure[] = [];

  const stepsByRecipe = new Map<string, Set<number>>();
  for (const recipe of recipes) {
    stepsByRecipe.set(recipe.id, new Set(recipe.steps.map((s) => s.stepNumber)));
  }

  const seen = new Map<string, Set<number>>();
  // Last step number emitted per recipe, to catch a recipe's own steps being
  // reordered — which would be the model rearranging a procedure, not just
  // interleaving two of them.
  const lastSeen = new Map<string, number>();

  for (const step of proposed) {
    const known = stepsByRecipe.get(step.recipeId);
    if (!known) {
      failures.push({ kind: "unknown-recipe", recipeId: step.recipeId });
      continue;
    }
    if (!known.has(step.stepNumber)) {
      failures.push({
        kind: "unknown-step",
        recipeId: step.recipeId,
        stepNumber: step.stepNumber,
      });
      continue;
    }

    const seenForRecipe = seen.get(step.recipeId) ?? new Set<number>();
    if (seenForRecipe.has(step.stepNumber)) {
      failures.push({
        kind: "duplicate-step",
        recipeId: step.recipeId,
        stepNumber: step.stepNumber,
      });
      continue;
    }
    seenForRecipe.add(step.stepNumber);
    seen.set(step.recipeId, seenForRecipe);

    const previous = lastSeen.get(step.recipeId);
    if (previous !== undefined && step.stepNumber < previous) {
      failures.push({
        kind: "out-of-order",
        recipeId: step.recipeId,
        stepNumber: step.stepNumber,
      });
    }
    lastSeen.set(step.recipeId, step.stepNumber);
  }

  // Every step must appear. A plan that silently omits "season to taste" is
  // worse than no plan, because the user has no reason to doubt it.
  const expected = recipes.reduce((sum, r) => sum + r.steps.length, 0);
  const accounted = [...seen.values()].reduce((sum, set) => sum + set.size, 0);
  if (accounted < expected) {
    failures.push({ kind: "missing-steps", count: expected - accounted });
  }

  return failures;
}

/**
 * Turns the failures into something worth putting in a log line.
 *
 * Never shown to the user — they get a generic message and a working fallback.
 * This is for working out whether a prompt change is needed.
 */
export function describeFailures(failures: ValidationFailure[]): string {
  return failures
    .map((f) => {
      switch (f.kind) {
        case "unknown-recipe":
          return `referenced unknown recipe ${f.recipeId}`;
        case "unknown-step":
          return `referenced step ${f.stepNumber} which does not exist in ${f.recipeId}`;
        case "duplicate-step":
          return `repeated step ${f.stepNumber} of ${f.recipeId}`;
        case "out-of-order":
          return `moved step ${f.stepNumber} of ${f.recipeId} before an earlier step`;
        case "missing-steps":
          return `omitted ${f.count} step(s)`;
      }
    })
    .join("; ");
}

// ── Fallback ───────────────────────────────────────────────────────────────────

/**
 * A plan built without the model: each recipe's steps in order, one recipe
 * after another.
 *
 * Used when the model is unavailable or returns something that fails
 * validation. It is not clever — it interleaves nothing — but it is correct,
 * complete, and better than an error page for someone who has already got the
 * ingredients out. The caller tells the user this is what happened, and does
 * not charge a credit for it.
 */
export function sequentialPlan(recipes: PlannableRecipe[]): CookPlan {
  const steps: CookPlanStep[] = [];
  let offset = 0;

  for (const recipe of recipes) {
    for (const step of [...recipe.steps].sort((a, b) => a.stepNumber - b.stepNumber)) {
      steps.push({
        recipeId: recipe.id,
        stepNumber: step.stepNumber,
        startOffsetMinutes: offset,
        note: null,
      });
      // Only a step's own timer contributes; hands-on time is unknowable and
      // guessing at it would put fake precision into a fallback whose entire
      // virtue is that it claims nothing.
      offset += Math.ceil((step.timerSeconds ?? 0) / 60);
    }
  }

  return { steps, totalMinutes: offset };
}

// ── Agent ──────────────────────────────────────────────────────────────────────

function buildUserMessage(recipes: PlannableRecipe[]): string {
  const described = recipes
    .map((r) => {
      const steps = r.steps
        .slice()
        .sort((a, b) => a.stepNumber - b.stepNumber)
        .map(
          (s) =>
            `    ${s.stepNumber}. ${s.instruction}` +
            (s.timerSeconds ? ` [timer: ${Math.round(s.timerSeconds / 60)} min]` : ""),
        )
        .join("\n");
      return `Recipe id: ${r.id}\nTitle: ${r.title}\nServes: ${r.servings}\nSteps:\n${steps}`;
    })
    .join("\n\n");

  return `Interleave these recipes so they finish together.\n\n${described}`;
}

export async function planMultiRecipeCook(
  recipes: PlannableRecipe[],
): Promise<PlanResult> {
  if (recipes.length < 2) {
    return { ok: false, error: "Pick at least two recipes to interleave." };
  }
  if (recipes.some((r) => r.steps.length === 0)) {
    return { ok: false, error: "Every recipe needs steps before it can be planned." };
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
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(recipes) }],
    });
    const block = message.content[0];
    if (!block || block.type !== "text") {
      return { ok: false, error: "Unexpected response from AI service." };
    }
    rawResponse = block.text.trim();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Planning failed" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawResponse);
  } catch {
    return { ok: false, error: "The planner returned something unreadable." };
  }

  const result = PlanResponseSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: "The planner returned an unexpected shape." };
  }

  const failures = validatePlan(result.data.steps, recipes);
  if (failures.length > 0) {
    // Logged, not surfaced. The user gets the sequential fallback and a plain
    // sentence; what the model did wrong is our problem to fix.
    console.error("Multi-recipe plan rejected:", describeFailures(failures));
    return { ok: false, error: "The planner produced a plan that didn't match the recipes." };
  }

  return {
    ok: true,
    plan: {
      totalMinutes: result.data.totalMinutes,
      steps: result.data.steps.map((s) => ({
        recipeId: s.recipeId,
        stepNumber: s.stepNumber,
        startOffsetMinutes: s.startOffsetMinutes,
        note: s.note ?? null,
      })),
    },
  };
}
