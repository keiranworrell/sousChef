import { cookies } from "next/headers";
import { fetchAuthSession } from "aws-amplify/auth/server";
import { createServerRunner } from "@aws-amplify/adapter-nextjs";
import { amplifyConfig } from "@/lib/amplify-config";

/**
 * Shared Amplify server runner.
 *
 * Exported so the middleware and server components use one configured instance
 * rather than each constructing their own — two runners built from the same
 * config work, but they can drift if the config is ever changed in one place.
 */
export const { runWithAmplifyServerContext } = createServerRunner({
  config: amplifyConfig,
});

/**
 * Resolves auth state in a server component.
 *
 * Doing this on the server matters for anything that renders differently when
 * signed in: a client-side check renders the signed-out markup first and
 * corrects it after hydration, which the user sees as a flash. Resolving it
 * here means the correct markup is the only markup ever sent.
 */
export async function isSignedIn(): Promise<boolean> {
  try {
    return await runWithAmplifyServerContext({
      nextServerContext: { cookies },
      operation: async (contextSpec) => {
        try {
          const session = await fetchAuthSession(contextSpec);
          return !!session.tokens;
        } catch {
          return false;
        }
      },
    });
  } catch {
    // Never let an auth-check failure break a public page — fall back to the
    // signed-out view, which is safe for every caller.
    return false;
  }
}
