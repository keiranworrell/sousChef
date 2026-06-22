import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import type { RecipeStep, RecipeWithDetails } from "@souschef/shared";
import { getApiClient } from "../../../../lib/api";

// ── Timer ─────────────────────────────────────────────────────────────────────

function useStepTimer(seconds: number): {
  display: string;
  isRunning: boolean;
  isDone: boolean;
  toggle: () => void;
  reset: () => void;
} {
  const [timeLeft, setTimeLeft] = useState(seconds);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setTimeLeft(seconds);
    setIsRunning(false);
  }, [seconds]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!isRunning) return;

    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setIsRunning(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  const mins = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const secs = (timeLeft % 60).toString().padStart(2, "0");

  return {
    display: `${mins}:${secs}`,
    isRunning,
    isDone: timeLeft === 0,
    toggle: () => setIsRunning((r) => !r),
    reset: () => {
      setIsRunning(false);
      setTimeLeft(seconds);
    },
  };
}

function StepTimer({ step }: { step: RecipeStep }): React.JSX.Element {
  const { display, isRunning, isDone, toggle, reset } = useStepTimer(
    step.timerSeconds ?? 0,
  );

  return (
    <View style={timerStyles.container}>
      <Text style={[timerStyles.display, isDone && timerStyles.displayDone]}>
        {isDone ? "Done!" : display}
      </Text>
      <View style={timerStyles.controls}>
        <TouchableOpacity
          style={[timerStyles.startBtn, isDone && timerStyles.disabled]}
          onPress={toggle}
          disabled={isDone}
        >
          <Text style={timerStyles.startBtnText}>
            {isRunning ? "Pause" : "Start"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={timerStyles.resetBtn} onPress={reset}>
          <Text style={timerStyles.resetBtnText}>Reset</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const timerStyles = StyleSheet.create({
  container: { marginTop: 32, backgroundColor: "#1f2937", borderRadius: 20, paddingVertical: 24, paddingHorizontal: 40, alignItems: "center", gap: 16 },
  display: { fontSize: 52, fontWeight: "700", color: "#ffffff", letterSpacing: -1 },
  displayDone: { color: "#f97316" },
  controls: { flexDirection: "row", gap: 12 },
  startBtn: { backgroundColor: "#f97316", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 24 },
  startBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  disabled: { opacity: 0.4 },
  resetBtn: { borderWidth: 1, borderColor: "#374151", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 24 },
  resetBtnText: { color: "#9ca3af", fontWeight: "600", fontSize: 14 },
});

// ── Cook screen ───────────────────────────────────────────────────────────────

export default function CookScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [recipe, setRecipe] = useState<RecipeWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    async function load(): Promise<void> {
      const api = await getApiClient();
      const res = await api.recipes.get(id);
      if ("data" in res) setRecipe(res.data);
      setLoading(false);
    }
    void load();
  }, [id]);

  // Keep screen awake during cooking
  useEffect(() => {
    void activateKeepAwakeAsync();
    return () => { deactivateKeepAwake(); };
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f97316" />
      </View>
    );
  }

  if (!recipe || recipe.steps.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>No steps to cook.</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backLink}>← Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const steps = [...recipe.steps].sort((a, b) => a.stepNumber - b.stepNumber);
  const step = steps[stepIndex]!;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  const progress = (stepIndex + 1) / steps.length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.exitBtn} onPress={() => router.back()}>
          <Text style={styles.exitBtnText}>✕</Text>
        </TouchableOpacity>
        <View style={styles.stepMeta}>
          <Text style={styles.recipeTitle} numberOfLines={1}>
            {recipe.title}
          </Text>
          <Text style={styles.stepCounter}>
            Step {stepIndex + 1} of {steps.length}
          </Text>
        </View>
        <View style={styles.exitBtn} />
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      {/* Step instruction */}
      <View style={styles.content}>
        <Text style={styles.instruction}>{step.instruction}</Text>
        {step.timerSeconds && step.timerSeconds > 0 && (
          <StepTimer key={step.id} step={step} />
        )}
      </View>

      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.navBtn, styles.prevBtn, isFirst && styles.navBtnDisabled]}
          onPress={() => setStepIndex((i) => i - 1)}
          disabled={isFirst}
        >
          <Text style={styles.prevBtnText}>← Prev</Text>
        </TouchableOpacity>

        {isLast ? (
          <TouchableOpacity
            style={[styles.navBtn, styles.nextBtn]}
            onPress={() => router.back()}
          >
            <Text style={styles.nextBtnText}>Finish 🎉</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.navBtn, styles.nextBtn]}
            onPress={() => setStepIndex((i) => i + 1)}
          >
            <Text style={styles.nextBtnText}>Next →</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#030712" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { color: "#6b7280", fontSize: 14 },
  backLink: { color: "#f97316", fontSize: 14, fontWeight: "600" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  exitBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  exitBtnText: { color: "#6b7280", fontSize: 18, fontWeight: "600" },
  stepMeta: { flex: 1, alignItems: "center" },
  recipeTitle: { fontSize: 11, fontWeight: "600", color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.8 },
  stepCounter: { fontSize: 13, fontWeight: "500", color: "#9ca3af", marginTop: 2 },
  progressTrack: { height: 3, backgroundColor: "#1f2937", marginHorizontal: 20, borderRadius: 99 },
  progressFill: { height: 3, backgroundColor: "#f97316", borderRadius: 99 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  instruction: { fontSize: 22, fontWeight: "500", color: "#f9fafb", textAlign: "center", lineHeight: 34 },
  bottomNav: { flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingBottom: 32, paddingTop: 16 },
  navBtn: { flex: 1, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  prevBtn: { borderWidth: 1, borderColor: "#1f2937" },
  prevBtnText: { color: "#6b7280", fontWeight: "600", fontSize: 15 },
  navBtnDisabled: { opacity: 0.2 },
  nextBtn: { backgroundColor: "#f97316" },
  nextBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
