import React from "react";
import { Stack } from "expo-router";

export default function RecipesLayout(): React.JSX.Element {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="new" />
      <Stack.Screen name="[id]/index" />
      <Stack.Screen
        name="[id]/cook"
        options={{ presentation: "fullScreenModal" }}
      />
    </Stack>
  );
}
