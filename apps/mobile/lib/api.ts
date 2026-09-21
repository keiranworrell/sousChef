import { fetchAuthSession } from "aws-amplify/auth";
import { createApiClient } from "@souschef/shared";
import { expiryFromClaim, needsRefresh } from "./token-cache";

// process is polyfilled by React Native; declare the subset we use here
declare const process: { env: Record<string, string | undefined> };

const BASE_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "";

type Cached = {
  client: ReturnType<typeof createApiClient>;
  /** When the token stops being usable, in ms. */
  expiresAt: number | null;
};

let cached: Cached | null = null;

/**
 * In-flight refresh, shared by everyone who asks while it is running.
 *
 * Screens fire several requests at once — the shopping list detail makes
 * seven, the recipe page three — and without this each one would start its own
 * session fetch on a cold cache. Amplify would end up doing the same work
 * concurrently, and on an expired token that is several redundant Cognito
 * round trips before the first real request goes out.
 */
let inFlight: Promise<Cached> | null = null;

/**
 * An API client carrying the current user's ID token.
 *
 * The client and the token are cached until the token is close to expiring.
 * This used to call `fetchAuthSession()` on every invocation, of which there
 * are 87 across the app — each one reading Amplify's token store and checking
 * expiry before the actual request could start, and refreshing against Cognito
 * when the token had aged out. Screens that load several things at once paid
 * it several times over, concurrently.
 *
 * Amplify does its own caching underneath, so this is not the only thing
 * standing between the app and Cognito. It does mean the common path is now a
 * comparison against a number rather than a trip through the token store.
 */
export async function getApiClient(): Promise<ReturnType<typeof createApiClient>> {
  if (cached && !needsRefresh(cached.expiresAt, Date.now())) {
    return cached.client;
  }

  if (!inFlight) {
    inFlight = (async (): Promise<Cached> => {
      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken;
        return {
          client: createApiClient(BASE_URL, idToken?.toString()),
          // `exp` is in seconds. Converting it is the whole job of
          // expiryFromClaim, and getting it wrong would leave the cache
          // technically present and never once used.
          expiresAt: expiryFromClaim(idToken?.payload?.exp),
        };
      } finally {
        // Cleared here rather than after the assignment below, so a rejected
        // refresh does not leave every later caller awaiting a dead promise.
        inFlight = null;
      }
    })();
  }

  cached = await inFlight;
  return cached.client;
}

/**
 * Drops the cached client.
 *
 * Called on sign-out so the next caller cannot be handed a client still
 * carrying the previous user's token — which on a shared phone would be one
 * account reading another's recipes until the token happened to expire.
 */
export function clearApiClientCache(): void {
  cached = null;
  inFlight = null;
}
