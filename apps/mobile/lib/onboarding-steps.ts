import type { OnboardingState, OnboardingStepId, PresentedStep } from "@souschef/shared";
import { firstOutstanding, presentSteps as sharedPresentSteps } from "@souschef/shared";

/**
 * Presentation for each onboarding step, on the phone.
 *
 * The ordering rules are shared with web; the copy and destinations are not.
 * Routes differ (`/(app)/recipes/new`, not `/recipes/new`), and so does the
 * wording where the phone can do something the browser cannot — photo import
 * is the obvious one, and it is worth naming in the very first step because it
 * is the reason to have the app at all.
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
    hint: "Snap a photo of a cookbook page, paste a link, or write it out.",
    href: "/(app)/recipes/new",
    cta: "Add a recipe",
  },
  "plan-meals": {
    label: "Plan a few meals",
    hint: "Put recipes on the days you'll cook them.",
    href: "/(app)/meal-plan",
    cta: "Open the planner",
  },
  "shopping-list": {
    label: "Make a shopping list",
    hint: "Build one from your plan — quantities are added up for you.",
    href: "/(app)/shopping",
    cta: "Make a list",
  },
  cook: {
    label: "Cook something",
    hint: "Guided steps, timers, and a place to note what you'd change.",
    href: "/(app)/recipes",
    cta: "Pick a recipe",
  },
};

export type MobilePresentedStep = PresentedStep<OnboardingStepCopy>;

export function presentSteps(state: OnboardingState): MobilePresentedStep[] {
  return sharedPresentSteps(state, ONBOARDING_COPY);
}

export function nextStep(state: OnboardingState): MobilePresentedStep | null {
  return firstOutstanding(state, ONBOARDING_COPY);
}
