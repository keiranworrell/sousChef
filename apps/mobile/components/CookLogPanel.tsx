import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CookLogEntry } from "@souschef/shared";
import { getApiClient } from "../lib/api";
import StarRating from "./StarRating";

type Props = {
  recipeId: string;
  entries: CookLogEntry[];
  loading: boolean;
  error: string | null;
  onEdit: (entry: CookLogEntry) => void;
  onRemoved: (entryId: string) => void;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}

/**
 * This user's own cooks of this recipe.
 *
 * Private, and it says so: notes like "too salty, halve the soy" are a working
 * note on someone else's recipe, not a review. The panel never renders on the
 * community screens for the same reason the web one doesn't.
 */
export default function CookLogPanel({
  recipeId,
  entries,
  loading,
  error,
  onEdit,
  onRemoved,
}: Props): React.JSX.Element | null {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function confirmRemove(entry: CookLogEntry): void {
    Alert.alert("Delete this entry?", `Your cook from ${formatDate(entry.cookedAt)}.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => { void remove(entry.id); },
      },
    ]);
  }

  async function remove(entryId: string): Promise<void> {
    setRemovingId(entryId);
    setActionError(null);
    try {
      const api = await getApiClient();
      const res = await api.recipes.deleteCookLogEntry(recipeId, entryId);
      if ("error" in res) throw new Error(res.error.message);
      onRemoved(entryId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Couldn't delete that entry");
    } finally {
      setRemovingId(null);
    }
  }

  // A failed load has to say so. Rendering nothing is indistinguishable from
  // "you've never cooked this", which is a different and misleading claim.
  if (error) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your cook log</Text>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  // Nothing yet and nothing in flight: stay out of the way. "Log cook" in the
  // actions row is the entry point, so an empty panel would be pure furniture.
  if (loading || entries.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Your cook log</Text>
        <Text style={styles.count}>
          {entries.length} {entries.length === 1 ? "cook" : "cooks"} · private to you
        </Text>
      </View>

      {actionError && <Text style={styles.error}>{actionError}</Text>}

      <View style={styles.list}>
        {entries.map((entry, index) => {
          const expanded = expandedId === entry.id;
          const hasNotes = Boolean(entry.notes);

          return (
            <View key={entry.id} style={[styles.row, index > 0 && styles.rowDivided]}>
              <TouchableOpacity
                style={styles.rowMain}
                // Only a toggle when there is something to reveal. Otherwise it
                // is static text and shouldn't offer a tap that does nothing.
                onPress={hasNotes ? () => setExpandedId(expanded ? null : entry.id) : undefined}
                disabled={!hasNotes}
                accessibilityRole={hasNotes ? "button" : "text"}
                accessibilityState={hasNotes ? { expanded } : undefined}
              >
                <View style={styles.rowTop}>
                  <Text style={styles.date}>{formatDate(entry.cookedAt)}</Text>
                  {entry.rating !== null && <StarRating value={entry.rating} size={14} />}
                  {hasNotes && (
                    <Text style={styles.notesToggle}>
                      {expanded ? "Hide notes" : "Notes"}
                    </Text>
                  )}
                </View>
                {expanded && entry.notes && (
                  <Text style={styles.notes}>{entry.notes}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onEdit(entry)}
                hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                accessibilityLabel={`Edit your cook from ${formatDate(entry.cookedAt)}`}
              >
                <Ionicons name="pencil-outline" size={16} color="#9ca3af" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => confirmRemove(entry)}
                disabled={removingId === entry.id}
                hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                accessibilityLabel={`Delete your cook from ${formatDate(entry.cookedAt)}`}
              >
                <Ionicons
                  name="close-outline"
                  size={18}
                  color={removingId === entry.id ? "#e5e7eb" : "#9ca3af"}
                />
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 24 },
  header: { marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: "600", color: "#111827" },
  count: { marginTop: 2, fontSize: 12, color: "#9ca3af" },
  list: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, backgroundColor: "#fff" },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 14, paddingVertical: 10 },
  rowDivided: { borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  rowMain: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  date: { fontSize: 13, color: "#374151", fontVariant: ["tabular-nums"] },
  notesToggle: { marginLeft: "auto", fontSize: 11, color: "#9ca3af" },
  notes: { marginTop: 6, fontSize: 13, color: "#6b7280", lineHeight: 19 },
  error: { color: "#dc2626", fontSize: 13, marginTop: 4 },
});
