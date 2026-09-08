"use client";

import { useState } from "react";
import { resetPassword } from "aws-amplify/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage(): React.JSX.Element {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await resetPassword({ username: email });
      router.push(`/reset-password?email=${encodeURIComponent(email)}`);
    } catch (err) {
      // Cognito distinguishes "no such user" from other failures, which would
      // let anyone probe whether an email has an account here. Rather than
      // surfacing that, treat a UserNotFound as success and continue to the
      // code screen — the code simply never arrives.
      //
      // Genuine faults (network, throttling) still surface, since silently
      // pretending those worked would leave the user waiting for an email that
      // was never going to come.
      const name = err instanceof Error ? err.name : "";
      if (name === "UserNotFoundException") {
        router.push(`/reset-password?email=${encodeURIComponent(email)}`);
        return;
      }
      if (name === "LimitExceededException") {
        setError("Too many attempts. Please wait a few minutes and try again.");
      } else {
        setError(err instanceof Error ? err.message : "Could not send reset code");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow dark:bg-gray-900">
        <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
          Reset your password
        </h1>
        <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
          Enter your email address and we&apos;ll send you a code to set a new password.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {loading ? "Sending…" : "Send reset code"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
          Remembered it?{" "}
          <Link href="/sign-in" className="text-orange-500 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
