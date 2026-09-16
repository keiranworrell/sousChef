import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "../client";
import { cookSessions, recipes, recipeSteps } from "../schema";
import type { CookPlan } from "../schema";
import type { PlannableRecipe } from "../../agents/multi-recipe-cook";
import { isRecipeInSharedCollection } from "./collection-share-queries";

export type CookSessionRecord = typeof cookSessions.$inferSelect;

/**
 * A session with the step text filled in.
 *
 * The stored plan holds references only, so the text is resolved at read time
 * from the recipes themselves. That means an edit to a recipe shows up in a
 * session in progress — which is right: the recipe is the source of truth, and
 * a cached copy silently diverging from it is the thing the reference-only
 * design exists to prevent.
 */
export type ResolvedCookStep = {
  recipeId: string;
  recipeTitle: string;
  stepNumber: number;
  instruction: string;
  timerSeconds: number | null;
  startOffsetMinutes: number;
  note: string | null;
};

export type CookSessionWithSteps = Omit<CookSessionRecord, "plan"> & {
  steps: ResolvedCookStep[];
  totalMinutes: number;
};

/**
 * Load recipes for planning, enforcing that the user may actually read each one.
 *
 * Returns null if any requested recipe is out of reach, rather than quietly
 * planning with the subset they can see — a plan missing a third of the meal
 * because one id was rejected is worse than a refusal, and the same rule as
 * everywhere else applies: no access is reported as not-found.
 */
export async function loadPlannableRecipes(
  userId: string,
  recipeIds: string[],
): Promise<PlannableRecipe[] | null> {
  const db = await getDb();

  const rows = await db
    .select({
      id: recipes.id,
      title: recipes.title,
      servings: recipes.servings,
      userId: recipes.userId,
      isPublic: recipes.isPublic,
    })
    .from(recipes)
    .where(inArray(recipes.id, recipeIds));

  if (rows.length !== recipeIds.length) return null;

  for (const row of rows) {
    if (row.userId === userId || row.isPublic) continue;
    const viaShare = await isRecipeInSharedCollection(row.id, userId);
    if (!viaShare) return null;
  }

  const stepRows = await db
    .select()
    .from(recipeSteps)
    .where(inArray(recipeSteps.recipeId, recipeIds))
    .orderBy(recipeSteps.stepNumber);

  // Keyed by id, then reassembled in the order the user picked them. The
  // planner sees them in that order, and so does the fallback.
  const byId = new Map(rows.map((r) => [r.id, r]));

  return recipeIds.map((id) => {
    const row = byId.get(id)!;
    return {
      id: row.id,
      title: row.title,
      servings: row.servings,
      steps: stepRows
        .filter((s) => s.recipeId === id)
        .map((s) => ({
          stepNumber: s.stepNumber,
          instruction: s.instruction,
          timerSeconds: s.timerSeconds,
        })),
    };
  });
}

export async function createCookSession(
  userId: string,
  recipeIds: string[],
  plan: CookPlan,
): Promise<CookSessionRecord> {
  const db = await getDb();
  const [row] = await db
    .insert(cookSessions)
    .values({ userId, recipeIds, plan })
    .returning();
  if (!row) throw new Error("Insert returned no rows");
  return row;
}

/**
 * Resolve a session's references into displayable steps.
 *
 * A reference whose step no longer exists — the recipe was edited mid-cook — is
 * dropped rather than rendered blank, and the caller can tell because the step
 * count no longer matches the plan. Showing an empty instruction to someone
 * mid-cook is worse than showing them one step fewer.
 */
export async function getCookSession(
  sessionId: string,
  userId: string,
): Promise<CookSessionWithSteps | null> {
  const db = await getDb();

  const [session] = await db
    .select()
    .from(cookSessions)
    .where(and(eq(cookSessions.id, sessionId), eq(cookSessions.userId, userId)))
    .limit(1);

  if (!session) return null;

  const [recipeRows, stepRows] = await Promise.all([
    db
      .select({ id: recipes.id, title: recipes.title })
      .from(recipes)
      .where(inArray(recipes.id, session.recipeIds)),
    db
      .select()
      .from(recipeSteps)
      .where(inArray(recipeSteps.recipeId, session.recipeIds)),
  ]);

  const titleById = new Map(recipeRows.map((r) => [r.id, r.title]));
  const stepKey = (recipeId: string, stepNumber: number): string =>
    `${recipeId}:${stepNumber}`;
  const stepByKey = new Map(
    stepRows.map((s) => [stepKey(s.recipeId, s.stepNumber), s]),
  );

  const steps: ResolvedCookStep[] = [];
  for (const planStep of session.plan.steps) {
    const step = stepByKey.get(stepKey(planStep.recipeId, planStep.stepNumber));
    if (!step) continue;
    steps.push({
      recipeId: planStep.recipeId,
      recipeTitle: titleById.get(planStep.recipeId) ?? "Unknown recipe",
      stepNumber: planStep.stepNumber,
      instruction: step.instruction,
      timerSeconds: step.timerSeconds,
      startOffsetMinutes: planStep.startOffsetMinutes,
      note: planStep.note ?? null,
    });
  }

  const { plan: _plan, ...rest } = session;
  return { ...rest, steps, totalMinutes: session.plan.totalMinutes };
}

/**
 * Save progress. Scoped to the owner in the WHERE clause, so a session id
 * belonging to someone else updates nothing.
 */
export async function updateCookSessionProgress(
  sessionId: string,
  userId: string,
  input: { currentStep?: number; completed?: boolean },
): Promise<boolean> {
  const db = await getDb();
  const updated = await db
    .update(cookSessions)
    .set({
      ...(input.currentStep !== undefined ? { currentStep: input.currentStep } : {}),
      ...(input.completed !== undefined
        ? { completedAt: input.completed ? new Date() : null }
        : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(cookSessions.id, sessionId), eq(cookSessions.userId, userId)))
    .returning({ id: cookSessions.id });
  return updated.length > 0;
}

/**
 * The user's most recent unfinished session, if any.
 *
 * Offered on return so someone who closed the tab mid-cook is taken back to it
 * rather than paying another credit to plan the same meal again.
 */
export async function getActiveCookSession(
  userId: string,
): Promise<CookSessionRecord | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(cookSessions)
    .where(and(eq(cookSessions.userId, userId), isNull(cookSessions.completedAt)))
    .orderBy(desc(cookSessions.createdAt))
    .limit(1);
  return row ?? null;
}
