// Polyfill must be the very first import
import "react-native-get-random-values";

import React, { useEffect, useRef, useState } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Amplify } from "aws-amplify";
import { cognitoUserPoolsTokenProvider } from "aws-amplify/auth/cognito";
import { fetchAuthSession } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { amplifyConfig } from "../lib/amplify-config";

Amplify.configure(amplifyConfig);
cognitoUserPoolsTokenProvider.setKeyValueStorage(AsyncStorage);

/**
 * How long to wait for the launch auth check before giving up on it.
 *
 * Long enough that a slow-but-working network still gets a real answer and the
 * user is not bounced to sign-in while already signed in; short enough that a
 * broken one does not look like a crash. Cold-start token refresh on a poor
 * connection is usually a second or two.
 */
const AUTH_CHECK_TIMEOUT_MS = 6000;

/**
 * Resolves null if `promise` has not settled within `ms`.
 *
 * Null rather than a rejection so the caller can tell "we could not find out"
 * from "there is no session" if it ever needs to. Today both mean the same
 * thing — show sign-in — but they are different facts and collapsing them here
 * would throw one away.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export default function RootLayout(): React.JSX.Element {
  const router = useRouter();
  const segments = useSegments();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Set once an auth event has told us something newer than the launch check.
  // The check below is async, so in principle an event can land while it is
  // still in flight; without this its stale answer would win on resolve.
  const supersededByEvent = useRef(false);

  useEffect(() => {
    // Subscribed before the initial read, so nothing that happens during it is
    // missed. Auth state used to be read exactly once at launch and never
    // again, which is the whole bug: signing in changed Cognito's mind and not
    // ours, so the guard below still believed the user was signed out and sent
    // them straight back to the sign-in screen — on top of a session that had
    // been created successfully. Hence "there is already a signed in user" on
    // the second attempt. Amplify announces every change on this channel.
    const stopListening = Hub.listen("auth", ({ payload }) => {
      switch (payload.event) {
        case "signedIn":
          supersededByEvent.current = true;
          setIsAuthenticated(true);
          setAuthChecked(true);
          break;
        case "signedOut":
        // A refresh failure means the tokens are gone or rejected. Treating it
        // as signed out sends the user to sign in, which is the truth; leaving
        // it would strand them in an app whose every request 401s.
        case "tokenRefresh_failure":
          supersededByEvent.current = true;
          setIsAuthenticated(false);
          setAuthChecked(true);
          break;
      }
    });

    async function checkAuth(): Promise<void> {
      try {
        // Bounded, because nothing renders until this settles and Expo Router
        // holds the splash screen until the first route renders. So a
        // fetchAuthSession that hangs rather than failing — an expired refresh
        // token, a captive portal, a phone on one bar — is not a slow start but
        // a permanently stuck splash with no way out except reinstalling.
        // That is exactly what happened: worked one day, stuck on the splash
        // the next.
        //
        // Timing out into "signed out" is the recoverable answer. It shows the
        // sign-in screen, which is wrong only until they sign in; the
        // alternative is a screen with nothing on it and nothing to do.
        const session = await withTimeout(fetchAuthSession(), AUTH_CHECK_TIMEOUT_MS);
        if (!supersededByEvent.current) setIsAuthenticated(!!session?.tokens);
      } catch {
        if (!supersededByEvent.current) setIsAuthenticated(false);
      } finally {
        setAuthChecked(true);
      }
    }
    void checkAuth();

    return stopListening;
  }, []);

  useEffect(() => {
    if (!authChecked) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    } else if (isAuthenticated && inAuthGroup) {
      router.replace("/(app)");
    }
  }, [authChecked, isAuthenticated, segments, router]);

  if (!authChecked) return <></>;

  // SafeAreaProvider has to wrap everything, and on Android 16 it stops being
  // optional: edge-to-edge is enforced from API 36, so every screen draws under
  // the status and navigation bars whether it expects to or not. React
  // Navigation reads its insets from this provider — without it the tab bar
  // sits under the gesture bar and headers under the clock.
  return (
    <SafeAreaProvider>
      <Slot />
    </SafeAreaProvider>
  );
}
