import React from "react";
import { Stack } from "expo-router";

/**
 * Groups `cook/[id]` so it is a route inside this stack rather than one the
 * tab navigator draws a tab for. See the note in `collections/_layout.tsx`.
 *
 * Presented fullscreen, like single-recipe cooking mode: this is a screen you
 * stand in front of with both hands busy, and a tab bar along the bottom is
 * both a distraction and a row of things to catch with a wet thumb.
 */
export default function CookLayout(): React.JSX.Element {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[id]" options={{ presentation: "fullScreenModal" }} />
    </Stack>
  );
}
