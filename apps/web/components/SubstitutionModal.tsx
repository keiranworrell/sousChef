"use client";

import React, { useEffect } from "react";
import type { Substitution } from "@souschef/shared";

type Props = {
  ingredientName: string;
  substitutions: Substitution[];
  onReplace: (sub: Substitution) => void;
  onClose: () => void;
};

export default function SubstitutionModal({
  ingredientName,
  substitutions,
  onReplace,
  onClose,
}: Props): React.JSX.Element {
  // Close on Escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-500">
              Substitutions for
            </p>
            <h2 className="mt-0.5 text-base font-semibold text-gray-900 capitalize dark:text-gray-100">
              {ingredientName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="ml-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Substitution list */}
        <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto dark:divide-gray-800">
          {substitutions.map((sub, i) => (
            <div
              key={i}
              className="flex items-start justify-between gap-3 px-5 py-3.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{sub.name}</p>
                {sub.notes && (
                  <p className="mt-0.5 text-xs text-gray-400 leading-snug">
                    {sub.notes}
                  </p>
                )}
              </div>
              <button
                onClick={() => onReplace(sub)}
                className="shrink-0 rounded-lg bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-600 transition-colors hover:bg-orange-500 hover:text-white dark:bg-orange-950 dark:text-orange-400 dark:hover:bg-orange-500 dark:hover:text-white"
              >
                Replace
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={onClose}
            className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
