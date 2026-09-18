import React from "react";
import { Stack } from "expo-router";

/**
 * Groups `users/[id]` so it is a route inside this stack rather than one the
 * tab navigator draws a tab for. See the note in `collections/_layout.tsx`.
 *
 * There is no `index` here on purpose: a list of every user is not a screen
 * this app has. Profiles are reached from a recipe, a feed row, or a
 * followers list.
 */
export default function UsersLayout(): React.JSX.Element {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
