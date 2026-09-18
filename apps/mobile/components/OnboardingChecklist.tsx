import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { OnboardingState } from "@souschef/shared";
import { completedCount } from "@souschef/shared";
import { presentSteps } from "../lib/onboarding-steps";
import { useTheme, useThemedStyles } from "./ThemeProvider";
import type { Palette } from "../lib/theme";

type Props = {
  state: OnboardingState;
  /** Shown above the list on a brand-new account. */
  welcome?: boolean;
};

/**
 * The core loop as a checklist: get a recipe in, plan a week, shop for it,
 * cook it.
 *
 * Every step is derived from rows the user actually has, so it is true on any
 * device and cannot claim someone is set up because they tapped through a
 * modal once. A completed step goes quiet — the label stays so the list does
 * not jump about, but the instruction and the button go, because neither is
 * any use once the thing is done.
 *
 * Deliberately not a modal, unlike web's welcome. A modal on first launch is
 * the thing everyone dismisses without reading, and dismissal would need to be
 * remembered somewhere; rendering this in the empty state instead means it
 * disappears when the user has recipes, which is the same signal the server
 * already derives.
 */
export default function OnboardingChecklist({
  state,
  welcome = false,
}: Props): React.JSX.Element {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const steps = presentSteps(state);
  const done = completedCount(state);

  return (
    <View style={styles.card}>
      {welcome && (
        <View style={styles.welcome}>
          <Text style={styles.welcomeTitle}>Welcome to sousChef</Text>
          <Text style={styles.welcomeBlurb}>
            Four things and you've seen the whole of it. Start wherever you like.
          </Text>
        </View>
      )}

      <View style={styles.progressRow}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${(done / steps.length) * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>{done} of {steps.length}</Text>
      </View>

      {steps.map((step) => (
        <View key={step.id} style={styles.step}>
          {step.done ? (
            <View style={styles.tick}>
              <Ionicons name="checkmark" size={12} color={palette.onAccent} />
            </View>
          ) : (
            <View style={styles.circle} />
          )}

          <View style={styles.stepBody}>
            <Text style={[styles.stepLabel, step.done && styles.stepLabelDone]}>
              {step.label}
            </Text>
            {/* Only while outstanding. A hint under a completed step is
                instructions for something already finished. */}
            {!step.done && (
              <>
                <Text style={styles.stepHint}>{step.hint}</Text>
                <TouchableOpacity
                  style={styles.cta}
                  onPress={() => router.push(step.href as never)}
                >
                  <Text style={styles.ctaText}>{step.cta}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  card: {
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  welcome: { gap: 4 },
  welcomeTitle: { fontSize: 18, fontWeight: "700", color: t.text },
  welcomeBlurb: { fontSize: 13, color: t.textMuted, lineHeight: 19 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  track: { flex: 1, height: 6, borderRadius: 999, backgroundColor: t.surfaceSunken, overflow: "hidden" },
  fill: { height: 6, borderRadius: 999, backgroundColor: t.accent },
  progressText: { fontSize: 11, color: t.textFaint, fontVariant: ["tabular-nums"] },
  step: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  tick: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: t.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  circle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: t.border,
    marginTop: 1,
  },
  stepBody: { flex: 1, minWidth: 0, gap: 4 },
  stepLabel: { fontSize: 14, fontWeight: "600", color: t.textSecondary },
  stepLabelDone: { color: t.textFaint, fontWeight: "500", textDecorationLine: "line-through" },
  stepHint: { fontSize: 12, color: t.textFaint, lineHeight: 17 },
  cta: {
    alignSelf: "flex-start",
    marginTop: 2,
    backgroundColor: t.accentSurface,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  ctaText: { fontSize: 12, fontWeight: "700", color: t.accentStrong },
});
