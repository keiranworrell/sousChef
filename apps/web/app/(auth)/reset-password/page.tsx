"use client";

import { Suspense, useState } from "react";
import { confirmResetPassword, resetPassword } from "aws-amplify/auth";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Mirrors the Cognito password policy in
 * infrastructure/terraform/modules/cognito/main.tf.
 *
 * Cognito is the enforcer — this is here so the user sees the rules before
 * submitting rather than discovering them one rejection at a time. If the
 * Terraform policy changes, change this too.
 */
const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "An uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "A lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "A number", test: (p: string) => /[0-9]/.test(p) },
];

function ResetPasswordForm(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [loading, setLoading] = useState(false);

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const allRulesMet = PASSWORD_RULES.every((r) => r.test(password));
  const canSubmit = code.length > 0 && allRulesMet && !mismatch && confirmPassword.length > 0;

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);

    try {
      await confirmResetPassword({
        username: email,
        confirmationCode: code,
        newPassword: password,
      });
      // Straight to sign-in rather than attempting an automatic sign-in: the
      // user has just set a password they may not have committed to memory, and
      // typing it once more confirms it landed as intended.
      router.replace("/sign-in?reset=1");
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "CodeMismatchException") {
        setError("That code doesn't match. Check the email and try again.");
      } else if (name === "ExpiredCodeException") {
        setError("That code has expired. Request a new one below.");
      } else if (name === "LimitExceededException") {
        setError("Too many attempts. Please wait a few minutes and try again.");
      } else {
        setError(err instanceof Error ? err.message : "Could not reset password");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend(): Promise<void> {
    setError(null);
    setResent(false);
    try {
      await resetPassword({ username: email });
      setResent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend code");
    }
  }

  // Reaching this page without an email means the address was lost somewhere —
  // most likely a direct link or a refresh that dropped the query. Sending them
  // back is better than a form that cannot succeed.
  if (!email) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="w-full max-w-sm rounded-lg bg-white p-8 text-center shadow dark:bg-gray-900">
          <h1 className="mb-2 text-xl font-bold text-gray-900 dark:text-gray-100">
            Something&apos;s missing
          </h1>
          <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
            We need your email address to reset your password.
          </p>
          <Link href="/forgot-password" className="btn-primary inline-block text-sm">
            Start again
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow dark:bg-gray-900">
        <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
          Set a new password
        </h1>
        <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
          We sent a code to <strong className="break-all">{email}</strong>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Reset code
            </label>
            <input
              id="code"
              type="text"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              New password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            {password.length > 0 && (
              <ul className="mt-2 space-y-1">
                {PASSWORD_RULES.map((rule) => {
                  const met = rule.test(password);
                  return (
                    <li
                      key={rule.label}
                      className={`flex items-center gap-1.5 text-xs ${
                        met ? "text-green-600 dark:text-green-400" : "text-gray-400"
                      }`}
                    >
                      <span aria-hidden>{met ? "✓" : "○"}</span>
                      {rule.label}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            {mismatch && (
              <p className="mt-1 text-xs text-red-600">Passwords do not match</p>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {resent && <p className="text-sm text-green-600">Code resent — check your inbox.</p>}

          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="w-full rounded bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {loading ? "Resetting…" : "Reset password"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => { void handleResend(); }}
          className="mt-4 w-full text-center text-sm text-orange-500 hover:underline"
        >
          Resend code
        </button>

        <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
          <Link href="/sign-in" className="text-orange-500 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage(): React.JSX.Element {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
