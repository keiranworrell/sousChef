import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { useThemedStyles } from "./ThemeProvider";
import type { Palette } from "../lib/theme";

type Props = {
  displayName: string;
  avatarUrl: string | null;
  size?: number;
};

/**
 * A person, as a circle.
 *
 * Falls back to the first letter of their name rather than a generic silhouette:
 * in a members list or a search result the initial is what tells two people
 * apart, and a row of identical grey outlines tells you nothing.
 */
export default function Avatar({
  displayName,
  avatarUrl,
  size = 36,
}: Props): React.JSX.Element {
  const styles = useThemedStyles(makeStyles);
  const dimensions = { width: size, height: size, borderRadius: size / 2 };

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[styles.image, dimensions]}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
    );
  }

  // charAt(0) rather than [0]: an empty display name would make the index
  // access undefined and render the string "undefined" inside the circle.
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";

  return (
    <View style={[styles.fallback, dimensions]}>
      <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{initial}</Text>
    </View>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  image: { backgroundColor: t.surfaceSunken, borderWidth: 1, borderColor: t.border },
  fallback: { backgroundColor: t.accentSurface, alignItems: "center", justifyContent: "center" },
  initial: { fontWeight: "700", color: t.accent },
});
