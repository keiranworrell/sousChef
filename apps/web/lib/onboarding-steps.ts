import type { OnboardingState, OnboardingStepId } from "@souschef/shared";

/**
 * Presentation for each onboarding step.
 *
 * The server says which steps are done; it says nothing about what they are
 * called or where they lead, because that is a UI question and baking copy into
 * an API response means a wording change needs a deploy of both.
 */

export type OnboardingStepCopy = {
  id: OnboardingStepId;
  label: string;
  /** Shown only while the step is outstanding — it's an instruction, not a description. */
  hint: string;
  href: string;
  cta: string;
};

export const ONBOARDING_COPY: Record<OnboardingStepId, Omit<OnboardingStepCopy, "id">> = {
  "add-recipe": {
    label: "Add your first recipe",
    hint: "Import one from a URL or a photo, or write it out yourself.",
    href: "/recipes/new",
    cta: "Add a recipe",
  },
  "plan-meals": {
    label: "Plan a few meals",
    hint: "Drop recipes onto the days you'll cook them.",
    href: "/meal-plans",
    cta: "Open the planner",
  },
  "shopping-list": {
    label: "Make a shopping list",
    hint: "Build one from your plan — quantities are added up for you.",
    href: "/shopping",
    cta: "Make a list",
  },
  cook: {
    label: "Cook something",
    hint: "Guided steps, timers, and a place to note what you'd change.",
    href: "/recipes",
    cta: "Pick a recipe",
  },
};

export type PresentedStep = OnboardingStepCopy & { done: boolean };

export function presentSteps(state: OnboardingState): PresentedStep[] {
  return state.steps.map((step) => ({
    id: step.id,
    done: step.done,
    ...ONBOARDING_COPY[step.id],
  }));
}

/**
 * The step to push someone towards: the first one they haven't done.
 *
 * Null when everything is done. Deliberately the *first* outstanding step
 * rather than the next in sequence after the last completed one — someone who
 * cooks a recipe without ever planning a week should still be nudged to try the
 * planner, not skipped past it.
 */
export function nextStep(state: OnboardingState): PresentedStep | null {
  return presentSteps(state).find((s) => !s.done) ?? null;
}

/** How many are done, for a progress indicator. */
export function completedCount(state: OnboardingState): number {
  return state.steps.filter((s) => s.done).length;
}
