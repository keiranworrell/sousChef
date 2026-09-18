import { FREE_TIER_AI_IMPORTS, type PlanTier } from "@souschef/shared";

/**
 * What the user may spend on AI, and what to tell them about it.
 *
 * One pool covers every AI action — imports from a photo or pasted text, and
 * planning a multi-recipe cook. `aiImportCount` is a lifetime counter with no
 * reset, so a free account gets FREE_TIER_AI_IMPORTS of these in total, ever,
 * across both features. Worth knowing before writing copy: "remaining" is not a
 * monthly allowance and should never be phrased as one.
 *
 * Kept out of the components because the honest wording at zero is the part
 * that is easy to get wrong, and it is the same wording in three places.
 */

export type AiCreditStatus =
  /** Premium. No counter, no ceiling. */
  | { kind: "unlimited" }
  /** Free, with credits left. */
  | { kind: "available"; remaining: number }
  /** Free, and out. Server-side, the next AI request is refused. */
  | { kind: "exhausted" }
  /** Not loaded yet. Distinct from exhausted, which it would otherwise look like. */
  | { kind: "unknown" };

export function aiCreditStatus(
  user: { planTier: PlanTier; aiImportsRemaining: number | null } | null | undefined,
): AiCreditStatus {
  if (!user) return { kind: "unknown" };
  // Null means premium — see the note on the field. Checked before planTier so
  // the two can never disagree about whether to draw a counter.
  if (user.aiImportsRemaining === null || user.planTier === "premium") {
    return { kind: "unlimited" };
  }
  if (user.aiImportsRemaining <= 0) return { kind: "exhausted" };
  return { kind: "available", remaining: user.aiImportsRemaining };
}

export type CreditNotice = {
  text: string;
  /**
   * True when the action cannot proceed at all, so the caller disables the
   * button rather than letting the user spend a tap discovering it.
   */
  blocking: boolean;
};

/**
 * What to say beneath a control that spends a credit.
 *
 * The exhausted wording says the request will be refused, because it will be.
 * `assertAiImportAllowed` runs *before* the planner in
 * `backend/functions/cook-sessions.ts` and throws; the sequential fallback below
 * it only catches a planner that failed, not a user who is out of credits. The
 * web launcher used to promise the fallback here and was wrong about it.
 */
export function cookPlanNotice(status: AiCreditStatus): CreditNotice | null {
  switch (status.kind) {
    case "unknown":
    case "unlimited":
      return null;
    case "available":
      return {
        text:
          status.remaining === 1
            ? "Planning uses your last free AI credit."
            : `Planning uses one of your ${status.remaining} remaining free AI credits.`,
        blocking: false,
      };
    case "exhausted":
      return {
        text:
          `You've used all ${FREE_TIER_AI_IMPORTS} free AI credits on this account, ` +
          `so a plan can't be generated. You can still cook these one at a time from each recipe.`,
        blocking: true,
      };
  }
}
