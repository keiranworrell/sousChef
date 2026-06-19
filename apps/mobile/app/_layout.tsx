// Polyfill must be the very first import
import "react-native-get-random-values";

import React, { useEffect, useState } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { Amplify } from "aws-amplify";
import { cognitoUserPoolsTokenProvider } from "aws-amplify/auth/cognito";
import { fetchAuthSession } from "aws-amplify/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { amplifyConfig } from "../lib/amplify-config";

Amplify.configure(amplifyConfig);
cognitoUserPoolsTokenProvider.setKeyValueStorage(AsyncStorage);

export default function RootLayout(): React.JSX.Element {
  const router = useRouter();
  const segments = useSegments();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    async function checkAuth(): Promise<void> {
      try {
        const session = await fetchAuthSession();
        setIsAuthenticated(!!session.tokens);
      } catch {
        setIsAuthenticated(false);
      } finally {
        setAuthChecked(true);
      }
    }
    void checkAuth();
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

  return <Slot />;
}
