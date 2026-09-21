// Polyfill must be the very first import
import "react-native-get-random-values";

import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Amplify } from "aws-amplify";
import { cognitoUserPoolsTokenProvider } from "aws-amplify/auth/cognito";
import { fetchAuthSession } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { amplifyConfig } from "../lib/amplify-config";
import { clearApiClientCache } from "../lib/api";
import ThemeProvider, { useTheme, useThemedStyles } from "../components/ThemeProvider";
import type { Palette } from "../lib/theme";

/**
 * Amplify is configured at module scope, so a throw here would kill the bundle
 * before React runs and the screen would say nothing at all.
 *
 * This was not the cause of the cold-start bug — the boot markers showed both
 * calls completing — but the failure mode it guards against is real and
 * completely invisible from the outside, which is what made that bug take four
 * attempts. Kept for that reason.
 */
let startupError: string | null = null;
try {
  Amplify.configure(amplifyConfig);
  cognitoUserPoolsTokenProvider.setKeyValueStorage(AsyncStorage);
} catch (err) {
  startupError = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

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

function RootLayoutInner(): React.JSX.Element {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
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
          // Also cleared on the way in: a client cached during the signed-out
          // window holds no token at all, and reusing it would 401 every
          // request until the token happened to expire.
          clearApiClientCache();
          supersededByEvent.current = true;
          setIsAuthenticated(true);
          setAuthChecked(true);
          break;
        case "signedOut":
        // A refresh failure means the tokens are gone or rejected. Treating it
        // as signed out sends the user to sign in, which is the truth; leaving
        // it would strand them in an app whose every request 401s.
        case "tokenRefresh_failure":
          // Before the state change, so nothing can pick up a cached client
          // carrying the old token on its way out. On a shared phone that
          // would be one account briefly able to read another's recipes.
          clearApiClientCache();
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

    const group = segments[0];
    const inAuthGroup = group === "(auth)";
    const inAppGroup = group === "(app)";

    // Both conditions test where the user *should not* be, rather than pairing
    // "signed in" with "in the auth group".
    //
    // The previous version asked `isAuthenticated && inAuthGroup`, which missed
    // the one route that is in neither group: `app/index.tsx`, the initial route
    // on a cold start. Signed in and sitting on it, neither branch matched —
    // the user was not signed out, and was not in the auth group — so nothing
    // navigated and the app rested on a placeholder screen showing the wordmark
    // and nothing else, indefinitely.
    //
    // It only ever happened on a cold start with a stored session. Signing out
    // was caught by the first branch; signing in happened from inside (auth),
    // so it was caught by the second. Reopening while already signed in was the
    // single path through the gap, which is why it looked like a hang specific
    // to having logged in before.
    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    } else if (isAuthenticated && !inAppGroup) {
      router.replace("/(app)");
    }
  }, [authChecked, isAuthenticated, segments, router]);

  // Visible rather than an empty fragment. Rendering nothing while waiting is
  // indistinguishable from the app being broken, and this screen is on the
  // critical path of every single launch.
  if (startupError) {
    return (
      <View style={styles.booting}>
        <Text style={styles.bootingTitle}>sousChef couldn&apos;t start</Text>
        <Text style={styles.bootingError}>{startupError}</Text>
      </View>
    );
  }

  if (!authChecked) {
    return (
      <View style={styles.booting}>
        <ActivityIndicator color={palette.accent} />
        <Text style={styles.bootingText}>Getting things ready…</Text>
      </View>
    );
  }

  return <Slot />;
}

/**
 * The providers, above everything including the boot screens.
 *
 * SafeAreaProvider has to wrap everything, and on Android 16 it stops being
 * optional: edge-to-edge is enforced from API 36, so every screen draws under
 * the status and navigation bars whether it expects to or not. React
 * Navigation reads its insets from this provider — without it the tab bar sits
 * under the gesture bar and headers under the clock.
 *
 * ThemeProvider goes outside it because the boot and startup-error screens are
 * screens too. They are the first thing anyone sees on a cold start, and a
 * white flash before a dark app is exactly the moment dark mode is supposed to
 * prevent.
 *
 * StatusBar follows the theme rather than being fixed: dark content on a dark
 * status bar is invisible, and this is the bar every screen draws under.
 */
export default function RootLayout(): React.JSX.Element {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <ThemedStatusBar />
        <RootLayoutInner />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

function ThemedStatusBar(): React.JSX.Element {
  const { theme } = useTheme();
  return <StatusBar style={theme === "dark" ? "light" : "dark"} />;
}

const makeStyles = (t: Palette) => StyleSheet.create({
  booting: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: t.bg,
  },
  bootingText: { fontSize: 13, color: t.textFaint },
  bootingTitle: { fontSize: 16, fontWeight: "600", color: t.text },
  bootingError: {
    fontSize: 12,
    color: t.danger,
    textAlign: "center",
    paddingHorizontal: 32,
  },
});
