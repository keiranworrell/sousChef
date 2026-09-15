"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { CookSession } from "@souschef/shared";
import { getApiClient } from "@/lib/api";
import { errorMessage, useToast } from "@/components/ToastProvider";

/**
 * Colour per recipe, so a glance tells you which pan this step belongs to.
 *
 * Paired with the recipe's name on every step rather than replacing it —
 * colour alone would be useless to anyone who can't distinguish these, and
 * "which dish is this" is the one question this screen must always answer.
 */
const RECIPE_COLOURS = [
  "text-orange-400",
  "text-sky-400",
  "text-emerald-400",
  "text-violet-400",
  "text-rose-400",
] as const;

function formatOffset(minutes: number): string {
  if (minutes <= 0) return "Start now";
  if (minutes < 60) return `~${minutes} min in`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `~${hours} hr in` : `~${hours} hr ${rest} min in`;
}

export default function MultiCookPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { showError } = useToast();

  const [session, setSession] = useState<CookSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const api = await getApiClient();
        const res = await api.cookSessions.get(id);
        if ("error" in res) {
          setLoadError(res.error.message);
          return;
        }
        setSession(res.data);
        // Resume where they left off. Clamped, because a recipe edited since
        // the plan was made can leave currentStep past the end.
        setStepIndex(Math.min(res.data.currentStep, Math.max(0, res.data.steps.length - 1)));
      } catch (err) {
        setLoadError(errorMessage(err, "Couldn't load this cook."));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id]);

  useEffect(() => {
    async function acquire(): Promise<void> {
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
        }
      } catch {
        // Wake lock not supported or denied — not critical
      }
    }
    void acquire();
    return () => {
      void wakeLockRef.current?.release();
    };
  }, []);

  /**
   * Progress is saved fire-and-forget. A failed save costs the user their
   * resume point, not their place in the cook, so blocking the Next button on
   * a round trip would be a worse trade than losing it.
   */
  const saveProgress = useCallback(
    (next: number): void => {
      void (async () => {
        try {
          const api = await getApiClient();
          await api.cookSessions.updateProgress(id, { currentStep: next });
        } catch {
          // Deliberately silent: see above. The cook continues either way.
        }
      })();
    },
    [id],
  );

  function goTo(next: number): void {
    setStepIndex(next);
    saveProgress(next);
  }

  async function handleFinish(): Promise<void> {
    setFinishing(true);
    try {
      const api = await getApiClient();
      const res = await api.cookSessions.updateProgress(id, { completed: true });
      if ("error" in res) throw new Error(res.error.message);
      router.push("/meal-plan");
    } catch (err) {
      showError(errorMessage(err, "Couldn't mark this cook finished."));
      setFinishing(false);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  if (loadError || !session) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-gray-950 px-8 text-center">
        <p className="text-gray-300">Couldn&apos;t load this cook.</p>
        {loadError && <p className="max-w-sm text-sm text-gray-500">{loadError}</p>}
        <button
          onClick={() => router.push("/meal-plan")}
          className="text-sm text-orange-400 hover:underline"
        >
          ← Back to the meal plan
        </button>
      </div>
    );
  }

  if (session.steps.length === 0) {
    // Reachable: every recipe in the plan was deleted or emptied since it was
    // made. Saying so beats an empty screen.
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-gray-950 px-8 text-center">
        <p className="text-gray-300">
          None of the steps in this plan exist any more.
        </p>
        <p className="max-w-sm text-sm text-gray-500">
          The recipes were probably edited after the plan was made.
        </p>
        <button
          onClick={() => router.push("/meal-plan")}
          className="text-sm text-orange-400 hover:underline"
        >
          ← Back to the meal plan
        </button>
      </div>
    );
  }

  const step = session.steps[stepIndex]!;
  const isLast = stepIndex === session.steps.length - 1;
  const progress = ((stepIndex + 1) / session.steps.length) * 100;

  // Stable per session: index into the session's own recipe list, so a recipe
  // keeps its colour from first step to last.
  const colour =
    RECIPE_COLOURS[session.recipeIds.indexOf(step.recipeId) % RECIPE_COLOURS.length] ??
    RECIPE_COLOURS[0];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-950">
      <div className="h-1 w-full bg-gray-900">
        <div
          className="h-full bg-orange-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between px-6 py-4">
        <button
          onClick={() => router.push("/meal-plan")}
          className="text-sm text-gray-500 hover:text-gray-300"
        >
          Exit
        </button>
        <p className="text-xs text-gray-500">
          Step {stepIndex + 1} of {session.steps.length}
          {session.totalMinutes > 0 && <> · about {session.totalMinutes} min total</>}
        </p>
      </div>

      <div className="flex flex-1 flex-col justify-center overflow-y-auto px-8 pb-8">
        <p className={`mb-2 text-sm font-semibold ${colour}`}>
          {step.recipeTitle}
          <span className="ml-2 font-normal text-gray-600">
            step {step.stepNumber}
          </span>
        </p>

        <p className="text-2xl leading-relaxed text-white">{step.instruction}</p>

        {step.note && (
          <p className="mt-4 rounded-xl border border-gray-800 bg-gray-900 px-4 py-3 text-sm text-gray-400">
            {step.note}
          </p>
        )}

        <p className="mt-4 text-xs text-gray-600">
          {formatOffset(step.startOffsetMinutes)}
          {step.timerSeconds ? ` · ${Math.round(step.timerSeconds / 60)} min timer` : ""}
        </p>
      </div>

      <div className="flex gap-3 px-6 pb-8">
        <button
          onClick={() => goTo(stepIndex - 1)}
          disabled={stepIndex === 0}
          className="rounded-xl border border-gray-800 px-6 py-4 text-sm font-semibold text-gray-300 transition-colors hover:bg-gray-900 disabled:opacity-30"
        >
          ← Back
        </button>
        {isLast ? (
          <button
            onClick={() => { void handleFinish(); }}
            disabled={finishing}
            className="flex-1 rounded-xl bg-orange-500 py-4 font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-60"
          >
            {finishing ? "Finishing…" : "Done"}
          </button>
        ) : (
          <button
            onClick={() => goTo(stepIndex + 1)}
            className="flex-1 rounded-xl bg-orange-500 py-4 font-semibold text-white transition-colors hover:bg-orange-600"
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
