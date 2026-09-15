"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { FREE_TIER_AI_IMPORTS } from "@souschef/shared";
import { getApiClient } from "@/lib/api";
import { errorMessage, useToast } from "@/components/ToastProvider";

type Candidate = {
  recipeId: string;
  title: string;
};

type Props = {
  dayLabel: string;
  candidates: Candidate[];
  /** Null on premium (no limit), a number on free, undefined while loading. */
  aiImportsRemaining: number | null | undefined;
  onClose: () => void;
};

const MAX_RECIPES = 5;

/**
 * Pick which of a day's recipes to cook together, then plan them.
 *
 * The meal plan doesn't carry step counts, so this can't tell in advance that a
 * recipe has no steps to plan around. The server rejects those by name and the
 * message surfaces as a toast — which is better than a filter here that quietly
 * drops a recipe the user expected to see in the list.
 *
 * The plan is a suggestion, and the copy says so. Presenting a model's timing
 * estimate as a schedule would be claiming a precision it does not have — it
 * has no idea how fast this particular person chops an onion — and someone who
 * trusts it and then finds the rice cold is worse off than someone who was told
 * it was a rough order of work.
 */
export default function MultiCookLauncher({
  dayLabel,
  candidates,
  aiImportsRemaining,
  onClose,
}: Props): React.JSX.Element {
  const router = useRouter();
  const { showError } = useToast();

  const [selected, setSelected] = useState<Set<string>>(
    // Pre-select everything plannable up to the cap: the common case is "cook
    // this whole day together", and unticking is less work than ticking.
    () => new Set(candidates.slice(0, MAX_RECIPES).map((c) => c.recipeId)),
  );
  const [planning, setPlanning] = useState(false);

  const atCap = selected.size >= MAX_RECIPES;
  const canPlan = selected.size >= 2 && !planning;
  const noCreditsLeft = aiImportsRemaining === 0;

  function toggle(recipeId: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(recipeId)) {
        next.delete(recipeId);
      } else if (next.size < MAX_RECIPES) {
        next.add(recipeId);
      }
      return next;
    });
  }

  async function handlePlan(): Promise<void> {
    setPlanning(true);
    try {
      const api = await getApiClient();
      const res = await api.cookSessions.create([...selected]);
      if ("error" in res) throw new Error(res.error.message);
      router.push(`/cook/${res.data.sessionId}`);
    } catch (err) {
      showError(errorMessage(err, "Couldn't plan that cook."));
      setPlanning(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Cook together</h2>
            <p className="mt-0.5 text-xs text-gray-400">{dayLabel}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <svg className="h-5 w-5" viewBox="0 0 16 16" fill="none">
              <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {candidates.length < 2 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              You need at least two recipes with steps on this day to plan them
              together.
            </p>
          ) : (
            <>
              <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                We&apos;ll suggest an order to work through so everything finishes
                around the same time. It&apos;s a rough plan, not a schedule —
                adjust as you go.
              </p>

              <ul className="space-y-1">
                {candidates.map((c) => {
                  const isSelected = selected.has(c.recipeId);
                  return (
                    <li key={c.recipeId}>
                      <label
                        className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-orange-50 dark:hover:bg-gray-800 ${
                          !isSelected && atCap ? "opacity-50" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!isSelected && atCap}
                          onChange={() => toggle(c.recipeId)}
                          className="h-4 w-4 accent-orange-500"
                        />
                        <span className="text-sm text-gray-800 dark:text-gray-200">
                          {c.title}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>

              {atCap && (
                <p className="mt-2 text-xs text-gray-400">
                  {MAX_RECIPES} is the most we&apos;ll plan at once.
                </p>
              )}

              {typeof aiImportsRemaining === "number" && (
                <p className="mt-3 text-xs text-gray-400">
                  {noCreditsLeft
                    ? `You've used all ${FREE_TIER_AI_IMPORTS} of your free AI credits. We'll still lay the recipes out one after another.`
                    : `Uses one of your ${aiImportsRemaining} remaining AI credits.`}
                </p>
              )}
            </>
          )}
        </div>

        {candidates.length >= 2 && (
          <div className="flex gap-2 border-t border-gray-100 px-5 py-4 dark:border-gray-800">
            <button
              onClick={() => { void handlePlan(); }}
              disabled={!canPlan}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {planning
                ? "Planning…"
                : selected.size < 2
                  ? "Pick at least two"
                  : `Plan ${selected.size} recipes`}
            </button>
            <button onClick={onClose} className="btn-secondary">
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
