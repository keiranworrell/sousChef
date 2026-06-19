import { fetchAuthSession } from "aws-amplify/auth";
import { createApiClient } from "@souschef/shared";

// process is polyfilled by React Native; declare the subset we use here
declare const process: { env: Record<string, string | undefined> };

const BASE_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "";

/**
 * Returns an API client pre-loaded with the current user's ID token.
 */
export async function getApiClient(): Promise<ReturnType<typeof createApiClient>> {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  return createApiClient(BASE_URL, token);
}
