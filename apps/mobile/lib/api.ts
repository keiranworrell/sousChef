import { fetchAuthSession } from "aws-amplify/auth";
import { createApiClient } from "@souschef/shared";

const BASE_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "";

/**
 * Returns an API client pre-loaded with the current user's ID token.
 */
export async function getApiClient(): Promise<ReturnType<typeof createApiClient>> {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  return createApiClient(BASE_URL, token);
}
