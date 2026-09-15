"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type Toast = {
  id: number;
  message: string;
  tone: "error" | "info";
};

type ToastContextValue = {
  /**
   * Surface a failure the user needs to know about but that has no obvious
   * place on the page — typically an optimistic action that the server
   * rejected after the UI already moved.
   */
  showError: (message: string) => void;
  showInfo: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

// Module-scoped counter rather than Date.now(): two failures landing in the
// same millisecond is exactly what happens when a connection drops mid-batch,
// and duplicate React keys would drop one of the messages.
let nextId = 1;

/**
 * Toasts exist here for one reason: optimistic writes.
 *
 * A failed page load has an obvious home for its error — the page itself, where
 * the content would have been. A failed *action* does not: the user has clicked
 * a checkbox in a list of forty, the UI has already moved, and there is nowhere
 * sensible to put a message except over the top of everything.
 *
 * So this is deliberately not a general notification system. Successes are not
 * announced (the UI changing is the announcement), and anything with a natural
 * inline home should use that instead.
 */
export function ToastProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: Toast["tone"]): void => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, tone }]);
    // Errors linger. A message about lost work that vanishes in three seconds
    // while the user is looking at their shopping list is barely better than no
    // message at all.
    const ttl = tone === "error" ? 8000 : 4000;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, ttl);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      showError: (message) => push(message, "error"),
      showInfo: (message) => push(message, "info"),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        // Assertive rather than polite: these report that something the user
        // thought had happened did not happen.
        role="alert"
        aria-live="assertive"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl px-4 py-3 text-sm shadow-lg ${
              toast.tone === "error"
                ? "bg-red-600 text-white"
                : "bg-gray-900 text-white"
            }`}
          >
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="shrink-0 opacity-70 transition-opacity hover:opacity-100"
              aria-label="Dismiss"
            >
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside a ToastProvider");
  }
  return ctx;
}

/**
 * Pulls a user-facing message out of whatever was thrown.
 *
 * `unwrap` attaches the server's message, so most of the time there is
 * something specific to say. The fallback exists for genuinely unexpected
 * throws, where a vague message is still better than silence.
 */
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
