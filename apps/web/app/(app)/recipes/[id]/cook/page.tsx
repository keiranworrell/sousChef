"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { RecipeStep, RecipeWithDetails } from "@souschef/shared";
import { getApiClient } from "@/lib/api";

// ── Timer ─────────────────────────────────────────────────────────────────────

function useStepTimer(seconds: number): {
  display: string;
  isRunning: boolean;
  isDone: boolean;
  toggle: () => void;
  reset: () => void;
} {
  const [timeLeft, setTimeLeft] = useState(seconds);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset when the step changes
  useEffect(() => {
    setTimeLeft(seconds);
    setIsRunning(false);
  }, [seconds]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!isRunning) return;

    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setIsRunning(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  const mins = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const secs = (timeLeft % 60).toString().padStart(2, "0");

  return {
    display: `${mins}:${secs}`,
    isRunning,
    isDone: timeLeft === 0,
    toggle: () => setIsRunning((r) => !r),
    reset: () => {
      setIsRunning(false);
      setTimeLeft(seconds);
    },
  };
}

function StepTimer({ step }: { step: RecipeStep }): React.JSX.Element {
  const { display, isRunning, isDone, toggle, reset } = useStepTimer(
    step.timerSeconds ?? 0,
  );

  return (
    <div className="mt-10 flex flex-col items-center gap-5 rounded-2xl bg-gray-900 px-10 py-7">
      <p
        className={`text-5xl font-bold tabular-nums tracking-tight transition-colors ${
          isDone ? "text-orange-400" : "text-white"
        }`}
      >
        {isDone ? "Done!" : display}
      </p>
      <div className="flex gap-3">
        <button
          onClick={toggle}
          disabled={isDone}
          className="rounded-lg bg-orange-500 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-40"
        >
          {isRunning ? "Pause" : "Start"}
        </button>
        <button
          onClick={reset}
          className="rounded-lg border border-gray-700 px-6 py-2 text-sm font-semibold text-gray-300 transition-colors hover:bg-gray-800"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

// ── Cook page ─────────────────────────────────────────────────────────────────

export default function CookPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [recipe, setRecipe] = useState<RecipeWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      const api = await getApiClient();
      const res = await api.recipes.get(id);
      if ("data" in res) setRecipe(res.data);
      setLoading(false);
    }
    void load();
  }, [id]);

  // Acquire screen wake lock so display doesn't sleep mid-cook
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

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  if (!recipe || recipe.steps.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-gray-950">
        <p className="text-gray-400">This recipe has no steps.</p>
        <button
          onClick={() => router.back()}
          className="text-sm text-orange-400 hover:underline"
        >
          ← Go back
        </button>
      </div>
    );
  }

  const steps = [...recipe.steps].sort((a, b) => a.stepNumber - b.stepNumber);
  const step = steps[stepIndex]!;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  const progress = ((stepIndex + 1) / steps.length) * 100;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-950">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
          aria-label="Exit cooking mode"
        >
          ✕
        </button>
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            {recipe.title}
          </p>
          <p className="mt-0.5 text-sm font-medium text-gray-300">
            Step {stepIndex + 1} of {steps.length}
          </p>
        </div>
        <div className="w-9" />
      </div>

      {/* Progress bar */}
      <div className="mx-6 h-1 overflow-hidden rounded-full bg-gray-800">
        <div
          className="h-full rounded-full bg-orange-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step content */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 py-10">
        <p className="max-w-xl text-center text-2xl font-medium leading-relaxed text-white">
          {step.instruction}
        </p>

        {step.timerSeconds && step.timerSeconds > 0 && (
          <StepTimer key={step.id} step={step} />
        )}
      </div>

      {/* Bottom nav */}
      <div className="flex gap-4 px-6 pb-12">
        <button
          onClick={() => setStepIndex((i) => i - 1)}
          disabled={isFirst}
          className="flex-1 rounded-xl border border-gray-700 py-4 font-semibold text-gray-300 transition-colors hover:bg-gray-800 disabled:opacity-20"
        >
          ← Previous
        </button>
        {isLast ? (
          <button
            onClick={() => router.back()}
            className="flex-1 rounded-xl bg-orange-500 py-4 font-semibold text-white transition-colors hover:bg-orange-600"
          >
            Finish 🎉
          </button>
        ) : (
          <button
            onClick={() => setStepIndex((i) => i + 1)}
            className="flex-1 rounded-xl bg-orange-500 py-4 font-semibold text-white transition-colors hover:bg-orange-600"
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
