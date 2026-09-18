import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import type { CookSession } from "@souschef/shared";
import { getApiClient } from "../../../lib/api";
import { formatOffset, recipeColour } from "../../../lib/cook-session";

/**
 * Cooking several recipes to one interleaved plan.
 *
 * The single-recipe cooking mode next door is a list of one dish's steps. This
 * is the same shape, but every step also has to answer "which pan is this?" —
 * so the recipe's name leads each step and carries a colour that stays with it
 * for the whole session.
 */
export default function MultiCookScreen(): React.JSX.Element {
  const { id, sequential } = useLocalSearchParams<{ id: string; sequential?: string }>();
  const router = useRouter();

  const [session, setSession] = useState<CookSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const api = await getApiClient();
        const res = await api.cookSessions.get(id);
        if ("error" in res) throw new Error(res.error.message);
        setSession(res.data);
        // Resume where they left off, clamped: a recipe edited since the plan
        // was made can leave currentStep past the end of the steps.
        setStepIndex(
          Math.min(res.data.currentStep, Math.max(0, res.data.steps.length - 1)),
        );
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Couldn't load this cook");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id]);

  useEffect(() => {
    void activateKeepAwakeAsync();
    return () => { deactivateKeepAwake(); };
  }, []);

  /**
   * Progress is saved fire-and-forget. A failed save costs the resume point,
   * not the cook, so blocking Next on a round trip would be the worse trade —
   * especially on a phone propped against a bag of flour with poor signal.
   */
  const saveProgress = useCallback((next: number): void => {
    void (async () => {
      try {
        const api = await getApiClient();
        await api.cookSessions.updateProgress(id, { currentStep: next });
      } catch {
        // Deliberately silent: see above.
      }
    })();
  }, [id]);

  function goTo(next: number): void {
    setStepIndex(next);
    saveProgress(next);
  }

  async function handleFinish(): Promise<void> {
    setFinishing(true);
    setFinishError(null);
    try {
      const api = await getApiClient();
      const res = await api.cookSessions.updateProgress(id, { completed: true });
      if ("error" in res) throw new Error(res.error.message);
      router.replace("/(app)/meal-plan");
    } catch (err) {
      setFinishError(err instanceof Error ? err.message : "Couldn't mark this finished");
      setFinishing(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator color="#f97316" />
      </View>
    );
  }

  if (loadError || !session) {
    return <Bail message={loadError ?? "Couldn't load this cook."} router={router} />;
  }

  if (session.steps.length === 0) {
    // Reachable: every recipe in the plan was deleted or emptied after it was
    // made. Saying so beats a blank screen with working buttons.
    return (
      <Bail
        message="None of the steps in this plan exist any more."
        detail="The recipes were probably edited after the plan was made."
        router={router}
      />
    );
  }

  const step = session.steps[stepIndex]!;
  const isLast = stepIndex === session.steps.length - 1;
  const progress = (stepIndex + 1) / session.steps.length;
  const colour = recipeColour(session.recipeIds, step.recipeId);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.replace("/(app)/meal-plan")}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.exit}>Exit</Text>
        </TouchableOpacity>
        <Text style={styles.counter}>
          Step {stepIndex + 1} of {session.steps.length}
          {session.totalMinutes > 0 ? ` · about ${session.totalMinutes} min total` : ""}
        </Text>
      </View>

      {/* Shown once, at the top, rather than on every step: the plan being
          sequential is a fact about the whole session, and repeating it would
          nag someone who already knows and cannot change it. */}
      {sequential === "1" && (
        <Text style={styles.sequentialNote}>
          We couldn't work out a combined timing for these, so they're laid out
          one recipe after another.
        </Text>
      )}

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.recipeName, { color: colour }]}>
          {step.recipeTitle}
          <Text style={styles.stepNumber}>  step {step.stepNumber}</Text>
        </Text>

        <Text style={styles.instruction}>{step.instruction}</Text>

        {step.note && <Text style={styles.note}>{step.note}</Text>}

        <Text style={styles.offset}>
          {formatOffset(step.startOffsetMinutes)}
          {step.timerSeconds ? ` · ${Math.round(step.timerSeconds / 60)} min timer` : ""}
        </Text>
      </ScrollView>

      {finishError && <Text style={styles.error}>{finishError}</Text>}

      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.navBtn, styles.prevBtn, stepIndex === 0 && styles.navDisabled]}
          onPress={() => goTo(stepIndex - 1)}
          disabled={stepIndex === 0}
        >
          <Text style={styles.prevText}>← Back</Text>
        </TouchableOpacity>
        {isLast ? (
          <TouchableOpacity
            style={[styles.navBtn, styles.nextBtn, finishing && styles.navDisabled]}
            onPress={() => { void handleFinish(); }}
            disabled={finishing}
          >
            {finishing
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.nextText}>Done</Text>}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.navBtn, styles.nextBtn]}
            onPress={() => goTo(stepIndex + 1)}
          >
            <Text style={styles.nextText}>Next →</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

function Bail({
  message,
  detail,
  router,
}: {
  message: string;
  detail?: string;
  router: ReturnType<typeof useRouter>;
}): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.bail}>
        <Text style={styles.bailText}>{message}</Text>
        {detail && <Text style={styles.bailDetail}>{detail}</Text>}
        <TouchableOpacity onPress={() => router.replace("/(app)/meal-plan")}>
          <Text style={styles.bailLink}>← Back to the meal plan</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#030712" },
  centerScreen: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#030712" },
  progressTrack: { height: 3, backgroundColor: "#1f2937" },
  progressFill: { height: 3, backgroundColor: "#f97316" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 12,
  },
  exit: { fontSize: 13, color: "#6b7280", fontWeight: "600" },
  counter: { flex: 1, textAlign: "right", fontSize: 11, color: "#6b7280" },
  sequentialNote: {
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#1f2937",
    color: "#9ca3af",
    fontSize: 12,
    lineHeight: 17,
  },
  content: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 26, paddingBottom: 24 },
  recipeName: { fontSize: 13, fontWeight: "700", marginBottom: 10 },
  stepNumber: { color: "#4b5563", fontWeight: "500" },
  instruction: { fontSize: 22, lineHeight: 33, color: "#f9fafb" },
  note: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
    backgroundColor: "#111827",
    color: "#9ca3af",
    fontSize: 13,
    lineHeight: 19,
  },
  offset: { marginTop: 16, fontSize: 12, color: "#4b5563" },
  error: { color: "#f87171", fontSize: 13, paddingHorizontal: 20, paddingBottom: 6 },
  bottomNav: { flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingBottom: 24, paddingTop: 12 },
  navBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center", justifyContent: "center" },
  prevBtn: { borderWidth: 1, borderColor: "#1f2937", paddingHorizontal: 22 },
  prevText: { color: "#6b7280", fontWeight: "600", fontSize: 15 },
  nextBtn: { flex: 1, backgroundColor: "#f97316" },
  nextText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  navDisabled: { opacity: 0.3 },
  bail: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 32 },
  bailText: { color: "#d1d5db", fontSize: 15, textAlign: "center" },
  bailDetail: { color: "#6b7280", fontSize: 13, textAlign: "center", lineHeight: 19 },
  bailLink: { color: "#f97316", fontSize: 14, fontWeight: "600", marginTop: 6 },
});
