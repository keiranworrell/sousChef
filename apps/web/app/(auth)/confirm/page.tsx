"use client";

import { useState, Suspense } from "react";
import { confirmSignUp, resendSignUpCode } from "aws-amplify/auth";
import { useRouter, useSearchParams } from "next/navigation";

function ConfirmForm(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await confirmSignUp({ username: email, confirmationCode: code });
      router.push("/sign-in");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirmation failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend(): Promise<void> {
    try {
      await resendSignUpCode({ username: email });
      setResent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend code");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow dark:bg-gray-900">
        <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">Check your email</h1>
        <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
          We sent a verification code to <strong>{email}</strong>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Verification code
            </label>
            <input
              id="code"
              type="text"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {resent && <p className="text-sm text-green-600">Code resent — check your inbox.</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {loading ? "Verifying…" : "Verify email"}
          </button>
        </form>

        <button
          onClick={handleResend}
          className="mt-4 w-full text-center text-sm text-orange-500 hover:underline"
        >
          Resend code
        </button>
      </div>
    </div>
  );
}

export default function ConfirmPage(): React.JSX.Element {
  return (
    <Suspense>
      <ConfirmForm />
    </Suspense>
  );
}
