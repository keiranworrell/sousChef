import type { OnboardingState } from "@souschef/shared";

/**
 * Whether the starter checklist is finished with, permanently.
 *
 * The steps are derived server-side from rows the user actually has, which is
 * the right way to measure *progress* — it cannot claim someone is set up
 * because they tapped through a modal once, and it is true on every device.
 *
 * But it makes the checklist reversible, and that is wrong. Delete your last
 * shopping list and the "make a shopping list" step un-completes, `complete`
 * flips back to false, and a checklist you finished weeks ago reappears on
 * your home screen telling you to get started. Being shown the tutorial again
 * for tidying up is worse than not seeing it at all.
 *
 * So "have you been onboarded" is kept separately from "what do you currently
 * have". It is a one-way door: once the loop has been completed once, or the
 * user has said go away, it stays shut.
 */

/**
 * Stored locally rather than on the user record.
 *
 * Per-device, which is the honest trade: a new install shows it again, and a
 * second device shows it once. Doing it properly means a column on `users`, an
 * endpoint and a migration, for a first-run aid that takes one tap to dismiss.
 * Worth revisiting if it ever annoys anyone; not worth a migration today.
 */
export const ONBOARDING_RETIRED_KEY = "souschef.onboardingRetired";

export function parseRetired(stored: string | null | undefined): boolean {
  return stored === "1";
}

export const RETIRED_VALUE = "1";

/**
 * Whether to draw the checklist at all.
 *
 * `retired` is undefined while storage is still being read. Treated as "do not
 * show": flashing a checklist onto the screen of someone who finished it
 * months ago, for the one frame before storage answers, is precisely the
 * reappearance this is meant to stop.
 */
export function shouldShowChecklist(
  state: OnboardingState | null,
  retired: boolean | undefined,
): boolean {
  if (retired !== false) return false;
  if (!state) return false;
  return !state.complete;
}

/**
 * Whether to write the flag now.
 *
 * Retiring happens on the transition to complete, so the last step ticks and
 * the checklist is gone next time rather than vanishing under the user's thumb
 * as they finish it.
 */
export function shouldRetire(
  state: OnboardingState | null,
  retired: boolean | undefined,
): boolean {
  return retired === false && state?.complete === true;
}
