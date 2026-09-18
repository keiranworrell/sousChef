import React from "react";
import { Text, StyleSheet, Linking, Alert } from "react-native";
import { hostnameOf } from "@souschef/shared";
import { useThemedStyles } from "./ThemeProvider";
import type { Palette } from "../lib/theme";

type Props = {
  sourceUrl: string | null;
  /** True once the user has edited a recipe that came from an external source. */
  sourceModified?: boolean;
};

/**
 * Credits where a recipe came from.
 *
 * The web counterpart of this component, and the same reasoning: a recipe
 * lifted from someone else's site should say so and link back, and "Adapted
 * from" is a meaningfully different claim from "Imported from".
 *
 * The phone is where this matters most in practice, because photo and URL
 * import both live here — a recipe can now enter the app on a device that,
 * until this screen, never showed where it came from.
 */
export default function SourceAttribution({
  sourceUrl,
  sourceModified = false,
}: Props): React.JSX.Element | null {
  const styles = useThemedStyles(makeStyles);
  const hostname = hostnameOf(sourceUrl);
  if (!hostname || !sourceUrl) return null;

  async function open(): Promise<void> {
    // Unlike an <a href>, this hands the URL to whatever the OS decides should
    // handle it. A stored sourceUrl the app cannot open is not worth an
    // unexplained no-op, so say so rather than swallowing it.
    try {
      await Linking.openURL(sourceUrl!);
    } catch {
      Alert.alert("Couldn't open that link", sourceUrl!);
    }
  }

  return (
    <Text
      style={styles.text}
      onPress={() => { void open(); }}
      accessibilityRole="link"
      accessibilityHint={`Opens ${hostname} in your browser`}
    >
      {sourceModified ? "Adapted from " : "Imported from "}
      <Text style={styles.host}>{hostname}</Text> ↗
    </Text>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  text: { fontSize: 12, color: t.textFaint, marginBottom: 12 },
  host: { fontWeight: "600", color: t.textMuted },
});
