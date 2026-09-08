"use client";

import { Suspense, useState } from "react";
import { signIn } from "aws-amplify/auth";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { sanitiseRedirect } from "@/lib/safe-redirect";

function SignInForm(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { isSignedIn } = await signIn({ username: email, password });
      if (isSignedIn) {
        // The middleware records where the user was heading before it bounced
        // them here. Previously this pushed to "/" unconditionally, so a deep
        // link was lost and — now that "/" is public — users landed on the
        // marketing page rather than in the app.
        //
        // sanitiseRedirect is what makes reading this query param safe; see the
        // open-redirect note in lib/safe-redirect.ts.
        const target = sanitiseRedirect(searchParams.get("next"));
        // replace, not push: the sign-in page should not sit in history behind
        // the destination, or Back returns to a form the user has already used.
        router.replace(target);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow dark:bg-gray-900">
        <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">Sign in</h1>

        {/* Confirms the reset actually took effect. Without it the user is
            returned to a bare sign-in form and can't tell whether it worked. */}
        {searchParams.get("reset") === "1" && (
          <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-400">
            Password updated. Sign in with your new password.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="shrink-0 text-xs text-orange-500 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
          No account?{" "}
          {/* Carry `next` across so a deep link survives the detour through
              sign-up and confirmation. */}
          <Link
            href={`/sign-up${searchParams.get("next") ? `?next=${encodeURIComponent(searchParams.get("next")!)}` : ""}`}
            className="text-orange-500 hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

/**
 * useSearchParams opts the subtree into client-side rendering, and Next requires
 * a Suspense boundary around it or the production build fails. The fallback
 * mirrors the card's dimensions so there is no layout shift when the form
 * appears.
 */
export default function SignInPage(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
          <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow dark:bg-gray-900">
            <div className="h-8 w-32 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
          </div>
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
