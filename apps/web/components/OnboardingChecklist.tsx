"use client";

import React from "react";
import Link from "next/link";
import type { OnboardingState } from "@souschef/shared";
import { completedCount, presentSteps } from "@/lib/onboarding-steps";

type Props = {
  state: OnboardingState;
  /** Called when a step's link is followed, so a containing modal can close. */
  onNavigate?: () => void;
};

function Tick(): React.JSX.Element {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white">
      <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path
          d="M2.5 6.5l2.5 2.5 4.5-5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/**
 * The core loop as a checklist: get a recipe in, plan a week, shop for it,
 * cook it.
 *
 * Every step is derived from rows the user actually has, so it is true on any
 * device and cannot claim someone is set up because they once dismissed a
 * modal. A completed step goes quiet — the label stays so the list doesn't jump
 * about, but the instruction and the button go, because neither is any use once
 * the thing is done.
 */
export default function OnboardingChecklist({
  state,
  onNavigate,
}: Props): React.JSX.Element {
  const steps = presentSteps(state);
  const done = completedCount(state);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div
            className="h-full rounded-full bg-orange-500 transition-all duration-300"
            style={{ width: `${(done / steps.length) * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-xs tabular-nums text-gray-400">
          {done} of {steps.length}
        </span>
      </div>

      <ul className="space-y-1">
        {steps.map((step) => (
          <li
            key={step.id}
            className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
          >
            {step.done ? (
              <Tick />
            ) : (
              <span
                className="mt-px h-5 w-5 shrink-0 rounded-full border-2 border-gray-200 dark:border-gray-700"
                aria-hidden="true"
              />
            )}

            <div className="min-w-0 flex-1">
              <p
                className={
                  step.done
                    ? "text-sm text-gray-400 line-through decoration-gray-300"
                    : "text-sm font-medium text-gray-800 dark:text-gray-200"
                }
              >
                {step.label}
              </p>
              {/* Only while outstanding. A hint under a completed step is
                  instructions for something already finished. */}
              {!step.done && (
                <p className="mt-0.5 text-xs leading-snug text-gray-400">{step.hint}</p>
              )}
            </div>

            {!step.done && (
              <Link
                href={step.href}
                onClick={onNavigate}
                className="shrink-0 self-center rounded-lg px-2.5 py-1 text-xs font-medium text-orange-600 transition-colors hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-950"
              >
                {step.cta}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
