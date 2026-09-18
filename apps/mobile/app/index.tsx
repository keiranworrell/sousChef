import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTheme, useThemedStyles } from "../components/ThemeProvider";
import type { Palette } from "../lib/theme";

/**
 * The route at `/`, which is where a cold start lands before the guard in the
 * root layout sends the user to `(app)` or `(auth)`.
 *
 * It should be on screen for a few hundred milliseconds and never be read. It
 * was previously a bare centred wordmark on no background, which is exactly
 * what a stuck app looks like — and when the guard did strand someone here, it
 * was mistaken for the splash screen for four rounds of debugging. Nobody
 * thought to suspect it, because it did not look like a screen the app owned.
 *
 * Now it says what it is doing. If this is ever visible for more than a moment
 * again, it names itself rather than sitting there looking like a crash.
 */
export default function Index(): React.JSX.Element {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.container}>
      <ActivityIndicator color={palette.accent} />
      <Text style={styles.text}>Getting things ready…</Text>
    </View>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: t.bg,
  },
  text: { fontSize: 13, color: t.textFaint },
});
