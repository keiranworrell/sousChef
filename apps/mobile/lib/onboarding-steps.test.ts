import { describe, expect, it } from "vitest";
import type { OnboardingState, OnboardingStepId } from "@souschef/shared";
import { completedCount } from "@souschef/shared";
import { ONBOARDING_COPY, nextStep, presentSteps } from "./onboarding-steps";

const IDS: OnboardingStepId[] = ["add-recipe", "plan-meals", "shopping-list", "cook"];

function state(done: Partial<Record<OnboardingStepId, boolean>>): OnboardingState {
  const steps = IDS.map((id) => ({ id, done: done[id] ?? false }));
  return { steps, complete: steps.every((s) => s.done), fresh: !done["add-recipe"] };
}

describe("mobile onboarding copy", () => {
  it("gives every step a label, a hint, a destination and a button", () => {
    for (const step of presentSteps(state({}))) {
      expect(step.label, step.id).toBeTruthy();
      expect(step.hint, step.id).toBeTruthy();
      expect(step.cta, step.id).toBeTruthy();
      expect(step.href, step.id).toBeTruthy();
    }
  });

  it("points at routes this app actually has", () => {
    // Web's copy shipped an href of "/meal-plans" against a route called
    // "/meal-plan", so its own button 404'd. Group prefix and all, these are
    // worth pinning rather than eyeballing.
    for (const step of presentSteps(state({}))) {
      expect(step.href, step.id).toMatch(/^\/\(app\)\//);
    }
    expect(ONBOARDING_COPY["plan-meals"].href).toBe("/(app)/meal-plan");
    expect(ONBOARDING_COPY["add-recipe"].href).toBe("/(app)/recipes/new");
    expect(ONBOARDING_COPY["shopping-list"].href).toBe("/(app)/shopping");
    expect(ONBOARDING_COPY.cook.href).toBe("/(app)/recipes");
  });

  it("carries the done flag through from the server", () => {
    const presented = presentSteps(state({ "add-recipe": true }));
    expect(presented.find((s) => s.id === "add-recipe")?.done).toBe(true);
    expect(presented.find((s) => s.id === "cook")?.done).toBe(false);
  });

  it("counts what's done", () => {
    expect(completedCount(state({}))).toBe(0);
    expect(completedCount(state({ "add-recipe": true, cook: true }))).toBe(2);
  });
});

describe("nextStep", () => {
  it("points at the first outstanding step, not the one after the last done", () => {
    // Someone who cooked without ever planning a week should still be nudged
    // towards the planner rather than skipped past it.
    expect(nextStep(state({ "add-recipe": true, cook: true }))?.id).toBe("plan-meals");
  });

  it("starts at the beginning for a new account", () => {
    expect(nextStep(state({}))?.id).toBe("add-recipe");
  });

  it("is null once everything is done", () => {
    const all = state({
      "add-recipe": true,
      "plan-meals": true,
      "shopping-list": true,
      cook: true,
    });
    expect(nextStep(all)).toBeNull();
  });
});
