import type { OnboardingState, OnboardingStepId, PresentedStep } from "@souschef/shared";
import {
  completedCount as sharedCompletedCount,
  firstOutstanding,
  presentSteps as sharedPresentSteps,
} from "@souschef/shared";

/**
 * Presentation for each onboarding step, on the web.
 *
 * The ordering and progress rules live in `packages/shared` because mobile
 * applies the same ones. What stays here is the copy and the hrefs, which are
 * this app's routes and nobody else's.
 */

export type OnboardingStepCopy = {
  label: string;
  /** Shown only while the step is outstanding — it's an instruction, not a description. */
  hint: string;
  href: string;
  cta: string;
};

export const ONBOARDING_COPY: Record<OnboardingStepId, OnboardingStepCopy> = {
  "add-recipe": {
    label: "Add your first recipe",
    hint: "Import one from a URL or a photo, or write it out yourself.",
    href: "/recipes/new",
    cta: "Add a recipe",
  },
  "plan-meals": {
    label: "Plan a few meals",
    hint: "Drop recipes onto the days you'll cook them.",
    // Was "/meal-plans", which is not a route this app has and never was — the
    // page is at /meal-plan. The checklist's own button 404'd.
    href: "/meal-plan",
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

export type WebPresentedStep = PresentedStep<OnboardingStepCopy>;

export function presentSteps(state: OnboardingState): WebPresentedStep[] {
  return sharedPresentSteps(state, ONBOARDING_COPY);
}

export function nextStep(state: OnboardingState): WebPresentedStep | null {
  return firstOutstanding(state, ONBOARDING_COPY);
}

export function completedCount(state: OnboardingState): number {
  return sharedCompletedCount(state);
}
