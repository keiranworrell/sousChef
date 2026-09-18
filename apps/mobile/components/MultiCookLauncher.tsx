import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { getApiClient } from "../lib/api";
import { aiCreditStatus, cookPlanNotice, type AiCreditStatus } from "../lib/ai-credits";
import { useTheme, useThemedStyles } from "./ThemeProvider";
import type { Palette } from "../lib/theme";

/** The server plans at most this many at once. */
const MAX_RECIPES = 5;

export type CookCandidate = {
  recipeId: string;
  title: string;
};

type Props = {
  visible: boolean;
  dayLabel: string;
  candidates: CookCandidate[];
  onClose: () => void;
};

/**
 * Pick which of a day's recipes to cook together, then plan them.
 *
 * The plan is a suggestion and the copy says so. Presenting a model's timing
 * estimate as a schedule would claim a precision it does not have — it has no
 * idea how fast this particular person chops an onion — and someone who trusts
 * it and finds the rice cold is worse off than someone told it was a rough
 * order of work.
 *
 * The meal plan doesn't carry step counts, so this can't know in advance that a
 * recipe has no steps to plan around. The server rejects those by name and the
 * message is shown as-is, which beats filtering here and silently dropping a
 * recipe the user expected to see listed.
 */
export default function MultiCookLauncher({
  visible,
  dayLabel,
  candidates,
  onClose,
}: Props): React.JSX.Element {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credits, setCredits] = useState<AiCreditStatus>({ kind: "unknown" });

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setPlanning(false);
    // Pre-select everything up to the cap: the common case is "cook this whole
    // day together", and unticking is less work than ticking.
    setSelected(new Set(candidates.slice(0, MAX_RECIPES).map((c) => c.recipeId)));

    let cancelled = false;
    async function loadCredits(): Promise<void> {
      try {
        const api = await getApiClient();
        const res = await api.users.me();
        if (cancelled || "error" in res) return;
        setCredits(aiCreditStatus(res.data));
      } catch {
        // Left as unknown, which shows no notice and blocks nothing. The server
        // is the authority on the quota; guessing "exhausted" from a failed
        // profile fetch would lock someone out over an unrelated error.
      }
    }
    void loadCredits();
    return () => { cancelled = true; };
  }, [visible, candidates]);

  const notice = cookPlanNotice(credits);
  const atCap = selected.size >= MAX_RECIPES;
  const enoughPicked = selected.size >= 2;
  const canPlan = enoughPicked && !planning && !notice?.blocking;

  function toggle(recipeId: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(recipeId)) next.delete(recipeId);
      else if (next.size < MAX_RECIPES) next.add(recipeId);
      return next;
    });
  }

  async function handlePlan(): Promise<void> {
    setPlanning(true);
    setError(null);
    try {
      const api = await getApiClient();
      const res = await api.cookSessions.create([...selected]);
      if ("error" in res) throw new Error(res.error.message);
      onClose();
      // The session screen tells the user when a plan came back sequential, so
      // the flag rides along rather than being re-fetched to ask.
      router.push(
        `/(app)/cook/${res.data.sessionId}${res.data.interleaved ? "" : "?sequential=1"}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't plan that cook");
      setPlanning(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View>
            <Text style={styles.title}>Cook together</Text>
            <Text style={styles.subtitle}>{dayLabel}</Text>
          </View>

          {candidates.length < 2 ? (
            <Text style={styles.blurb}>
              You need at least two recipes on this day to plan them together.
            </Text>
          ) : (
            <>
              <Text style={styles.blurb}>
                We'll suggest an order to work through so everything finishes
                around the same time. It's a rough plan, not a schedule — adjust
                as you go.
              </Text>

              <ScrollView style={styles.list}>
                {candidates.map((c) => {
                  const isSelected = selected.has(c.recipeId);
                  const blocked = !isSelected && atCap;
                  return (
                    <TouchableOpacity
                      key={c.recipeId}
                      style={[styles.row, blocked && styles.rowBlocked]}
                      onPress={() => toggle(c.recipeId)}
                      disabled={blocked}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isSelected, disabled: blocked }}
                    >
                      <View style={[styles.box, isSelected && styles.boxChecked]}>
                        {isSelected && <Text style={styles.tick}>✓</Text>}
                      </View>
                      <Text style={styles.rowTitle} numberOfLines={2}>{c.title}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {atCap && (
                <Text style={styles.hint}>{MAX_RECIPES} is the most we'll plan at once.</Text>
              )}

              {notice && (
                <Text style={[styles.hint, notice.blocking && styles.hintBlocking]}>
                  {notice.text}
                </Text>
              )}
            </>
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.actions}>
            {candidates.length >= 2 && (
              <TouchableOpacity
                style={[styles.primary, !canPlan && styles.disabled]}
                onPress={() => { void handlePlan(); }}
                disabled={!canPlan}
              >
                {planning ? (
                  <ActivityIndicator color={palette.onAccent} />
                ) : (
                  <Text style={styles.primaryText}>
                    {!enoughPicked ? "Pick at least two" : `Plan ${selected.size} recipes`}
                  </Text>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.secondary} onPress={onClose} disabled={planning}>
              <Text style={styles.secondaryText}>
                {candidates.length < 2 ? "Close" : "Cancel"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: t.overlay },
  sheet: {
    backgroundColor: t.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    gap: 12,
    maxHeight: "80%",
  },
  title: { fontSize: 17, fontWeight: "700", color: t.text },
  subtitle: { marginTop: 2, fontSize: 12, color: t.textFaint },
  blurb: { fontSize: 13, color: t.textMuted, lineHeight: 19 },
  list: { maxHeight: 280 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11 },
  rowBlocked: { opacity: 0.4 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: t.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  boxChecked: { backgroundColor: t.accent, borderColor: t.accent },
  tick: { color: t.onAccent, fontSize: 13, fontWeight: "700" },
  rowTitle: { flex: 1, minWidth: 0, fontSize: 14, color: t.text },
  hint: { fontSize: 12, color: t.textFaint, lineHeight: 17 },
  hintBlocking: { color: t.accentText },
  error: { fontSize: 13, color: t.danger },
  actions: { flexDirection: "row", gap: 10 },
  primary: { flex: 1, backgroundColor: t.accent, borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  primaryText: { color: t.onAccent, fontWeight: "600", fontSize: 14 },
  secondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: t.borderStrong,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryText: { color: t.textSecondary, fontWeight: "600", fontSize: 14 },
  disabled: { opacity: 0.5 },
});
