import type { OnboardingState, OnboardingStepId } from "../types";

/**
 * Ordering and progress for the onboarding checklist.
 *
 * The server says which steps are done. It says nothing about what they are
 * called or where they lead, because that is a UI question — and the answer
 * differs per platform anyway, since `/recipes/new` and `/(app)/recipes/new`
 * are not the same string.
 *
 * So the copy lives in each app and only the rules live here. The rule worth
 * sharing is `firstOutstanding`, which has a real decision in it.
 */

export type PresentedStep<Copy> = Copy & {
  id: OnboardingStepId;
  done: boolean;
};

export function presentSteps<Copy>(
  state: OnboardingState,
  copy: Record<OnboardingStepId, Copy>,
): PresentedStep<Copy>[] {
  return state.steps.map((step) => ({
    id: step.id,
    done: step.done,
    ...copy[step.id],
  }));
}

/**
 * The step to push someone towards: the first one they have not done.
 *
 * Deliberately the *first* outstanding step rather than the next in sequence
 * after the last completed one. Someone who cooks a recipe without ever
 * planning a week should still be nudged towards the planner, not skipped past
 * it because they happened to complete a later step first.
 *
 * Null when everything is done.
 */
export function firstOutstanding<Copy>(
  state: OnboardingState,
  copy: Record<OnboardingStepId, Copy>,
): PresentedStep<Copy> | null {
  return presentSteps(state, copy).find((s) => !s.done) ?? null;
}

/** How many are done, for a progress indicator. */
export function completedCount(state: OnboardingState): number {
  return state.steps.filter((s) => s.done).length;
}
