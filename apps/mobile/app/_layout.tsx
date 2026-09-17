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
        const session = await fetchAuthSession();
        if (!supersededByEvent.current) setIsAuthenticated(!!session.tokens);
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
