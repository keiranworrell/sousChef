"use client";

import React, { useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "sc_onboarding_done";

export function shouldShowWelcome(): boolean {
  if (typeof window === "undefined") return false;
  return !localStorage.getItem(STORAGE_KEY);
}

export function markWelcomeDone(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, "1");
}

type Step = 0 | 1 | 2;

type Props = {
  onClose: () => void;
};

export default function WelcomeModal({ onClose }: Props): React.JSX.Element {
  const [step, setStep] = useState<Step>(0);

  function dismiss(): void {
    markWelcomeDone();
    onClose();
  }

  function next(): void {
    if (step < 2) {
      setStep((s) => (s + 1) as Step);
    } else {
      dismiss();
    }
  }

  const isLast = step === 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-2xl overflow-hidden">
        {/* Orange top bar */}
        <div className="h-1.5 bg-orange-500">
          <div
            className="h-full bg-orange-600 transition-all duration-300"
            style={{ width: `${((step + 1) / 3) * 100}%` }}
          />
        </div>

        <div className="px-7 py-8">
          {/* Step indicator */}
          <div className="mb-6 flex items-center gap-1.5">
            {([0, 1, 2] as Step[]).map((s) => (
              <span
                key={s}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  s === step
                    ? "w-5 bg-orange-500"
                    : s < step
                    ? "w-2 bg-orange-300 dark:bg-orange-700"
                    : "w-2 bg-gray-200 dark:bg-gray-700"
                }`}
              />
            ))}
          </div>

          {/* Content */}
          {step === 0 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Welcome to sousChef 👋
              </h2>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Your kitchen, organised. Let&apos;s get you set up in three quick steps.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {[
                  { icon: "📖", label: "Save recipes", desc: "Import from any URL or create your own" },
                  { icon: "🛒", label: "Plan meals", desc: "Weekly planner with auto shopping lists" },
                  { icon: "🥫", label: "Track pantry", desc: "Know what you have and what's running low" },
                  { icon: "🧑‍🍳", label: "Cook smarter", desc: "Guided cooking mode with per-step timers" },
                ].map(({ icon, label, desc }) => (
                  <div
                    key={label}
                    className="rounded-xl border border-gray-100 dark:border-gray-800 p-3"
                  >
                    <span className="text-xl">{icon}</span>
                    <p className="mt-1 text-xs font-semibold text-gray-800 dark:text-gray-200">{label}</p>
                    <p className="mt-0.5 text-xs text-gray-400 leading-snug">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Add your first recipe
              </h2>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Import from a URL, a photo, or paste in plain text — or build one from scratch.
              </p>
              <div className="mt-6 space-y-2">
                {[
                  { icon: "🔗", label: "Paste a URL", desc: "From any recipe website", href: "/recipes/new?import=url" },
                  { icon: "📷", label: "Upload a photo", desc: "Snap a recipe from a book or card", href: "/recipes/new?import=photo" },
                  { icon: "📝", label: "Paste text", desc: "Copy any text or handwritten notes", href: "/recipes/new?import=text" },
                  { icon: "✏️", label: "Write from scratch", desc: "Build a recipe step by step", href: "/recipes/new" },
                ].map(({ icon, label, desc, href }) => (
                  <Link
                    key={label}
                    href={href}
                    onClick={dismiss}
                    className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-800 p-3 hover:border-orange-200 hover:bg-orange-50 dark:hover:border-orange-800 dark:hover:bg-orange-950 transition-colors"
                  >
                    <span className="text-xl shrink-0">{icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
                      <p className="text-xs text-gray-400">{desc}</p>
                    </div>
                    <span className="ml-auto text-gray-300 dark:text-gray-600">→</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Explore the community
              </h2>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Browse thousands of recipes shared by home cooks, then fork any one into your collection.
              </p>
              <div className="mt-6 rounded-xl border border-orange-100 dark:border-orange-900 bg-orange-50 dark:bg-orange-950 p-5">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  Find something that looks good
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-4">
                  Browse community recipes, filter by cuisine or ingredient, and fork anything you like straight into your own collection.
                </p>
                <Link
                  href="/community"
                  onClick={dismiss}
                  className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
                >
                  Browse community recipes
                </Link>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={dismiss}
              className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              Skip for now
            </button>
            <button
              type="button"
              onClick={next}
              className="btn-primary text-sm"
            >
              {isLast ? "Get started" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
