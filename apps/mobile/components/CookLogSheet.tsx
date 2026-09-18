import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import type { CookLogEntry, LogCookInput } from "@souschef/shared";
import { diffCookLogEdit, draftFromEntry, toDateInputValue } from "@souschef/shared";
import { getApiClient } from "../lib/api";
import { labelForDay, recentDays } from "../lib/recent-days";
import StarRating from "./StarRating";

/** How far back the day strip goes. See the note in lib/recent-days.ts. */
const STRIP_DAYS = 14;

type Props = {
  visible: boolean;
  recipeId: string;
  /** The entry being edited, or null to log a new cook. */
  entry?: CookLogEntry | null;
  onClose: () => void;
  onSaved: (entry: CookLogEntry) => void;
};

/**
 * Logging a cook, and editing one already logged.
 *
 * One sheet for both, because they are the same four fields and the only
 * difference is which request they end up in. Two components would be two
 * places to get the rating-clearing behaviour wrong.
 */
export default function CookLogSheet({
  visible,
  recipeId,
  entry = null,
  onClose,
  onSaved,
}: Props): React.JSX.Element {
  const [today] = useState(() => new Date());
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [cookedAt, setCookedAt] = useState(() => toDateInputValue(today.toISOString()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset on each open rather than on mount. The sheet stays mounted between
  // openings, so without this, logging a second cook would arrive pre-filled
  // with the first one's notes.
  useEffect(() => {
    if (!visible) return;
    setError(null);
    if (entry) {
      const draft = draftFromEntry(entry);
      setRating(draft.rating);
      setNotes(draft.notes);
      setCookedAt(draft.cookedAt);
    } else {
      setRating(null);
      setNotes("");
      setCookedAt(toDateInputValue(new Date().toISOString()));
    }
  }, [visible, entry]);

  const days = recentDays(today, STRIP_DAYS);
  // An entry older than the strip still needs a chip to sit on, or the sheet
  // would open with nothing selected and quietly re-date it on save.
  const options = days.some((d) => d.iso === cookedAt)
    ? days
    : [{ iso: cookedAt, label: labelForDay(cookedAt, today, STRIP_DAYS) }, ...days];

  async function handleSave(): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      const api = await getApiClient();

      if (entry) {
        const update = diffCookLogEdit(entry, { rating, cookedAt, notes });
        // Nothing changed. Closing is the honest response — an empty patch
        // earns a 400 telling the user off for touching nothing.
        if (Object.keys(update).length === 0) {
          onClose();
          return;
        }
        const res = await api.recipes.updateCookLogEntry(recipeId, entry.id, update);
        if ("error" in res) throw new Error(res.error.message);
        onSaved(narrow(res.data));
      } else {
        const input: LogCookInput = {
          rating,
          notes: notes.trim() || null,
          cookedAt,
        };
        const res = await api.recipes.logCook(recipeId, input);
        if ("error" in res) throw new Error(res.error.message);
        onSaved(narrow(res.data));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save this cook");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.sheet}>
          <View>
            <Text style={styles.title}>{entry ? "Edit this cook" : "Log a cook"}</Text>
            <Text style={styles.subtitle}>Only you can see this</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Rating</Text>
            <View style={styles.ratingRow}>
              <StarRating value={rating} onChange={setRating} />
              <Text style={styles.hint}>
                {rating === null ? "Optional" : "Tap again to clear"}
              </Text>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>When</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.strip}
            >
              {options.map((day) => {
                const active = day.iso === cookedAt;
                return (
                  <TouchableOpacity
                    key={day.iso}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setCookedAt(day.iso)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {day.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={styles.input}
              value={notes}
              onChangeText={setNotes}
              placeholder="What would you change next time?"
              placeholderTextColor="#9ca3af"
              multiline
              maxLength={2000}
            />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.primary, saving && styles.disabled]}
              onPress={() => { void handleSave(); }}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondary} onPress={onClose} disabled={saving}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * Both endpoints answer with the history shape, which carries the recipe's
 * title and image for the account-wide list. The panel on this screen is
 * already under that recipe's heading, so it keeps the bare shape and the extra
 * fields are dropped here rather than lingering in state as a second, staler
 * copy of the title.
 */
function narrow(entry: CookLogEntry): CookLogEntry {
  return {
    id: entry.id,
    userId: entry.userId,
    recipeId: entry.recipeId,
    cookedAt: entry.cookedAt,
    rating: entry.rating,
    notes: entry.notes,
  };
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    gap: 16,
  },
  title: { fontSize: 17, fontWeight: "700", color: "#111827" },
  subtitle: { marginTop: 2, fontSize: 12, color: "#9ca3af" },
  field: { gap: 8 },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  hint: { fontSize: 12, color: "#9ca3af" },
  strip: { gap: 8, paddingRight: 8 },
  chip: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: "#fff7ed", borderColor: "#f97316" },
  chipText: { fontSize: 13, color: "#6b7280", fontWeight: "500" },
  chipTextActive: { color: "#ea580c", fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
    minHeight: 80,
    textAlignVertical: "top",
  },
  actions: { flexDirection: "row", gap: 10 },
  primary: { flex: 1, backgroundColor: "#f97316", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  secondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryText: { color: "#374151", fontWeight: "600", fontSize: 14 },
  disabled: { opacity: 0.5 },
  error: { color: "#dc2626", fontSize: 13 },
});
