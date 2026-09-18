import React from "react";
import { Stack } from "expo-router";

/**
 * Without this file, `[id]` is not a child of `collections` — it is a sibling
 * route called `collections/[id]`, and the tab navigator gives every route it
 * can see a tab. That is where the stray "collect…" button in the bottom bar
 * came from, and tapping it navigated to the detail screen with no id, which
 * is why it landed on the error page.
 *
 * `recipes`, `shopping`, `community` and `fermentation` all had one of these
 * already, which is why none of them leaked.
 */
export default function CollectionsLayout(): React.JSX.Element {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
