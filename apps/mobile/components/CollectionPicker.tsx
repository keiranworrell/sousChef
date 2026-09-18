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
import type { CollectionSummary } from "@souschef/shared";
import { getApiClient } from "../lib/api";
import { membershipChanges } from "../lib/collection-membership";
import { permissionsFor } from "../lib/collection-access";

type Props = {
  visible: boolean;
  recipeId: string;
  onClose: () => void;
  /** Fired after a successful save, so the caller can refresh a count. */
  onSaved?: () => void;
};

/**
 * Which collections a recipe belongs to.
 *
 * Only collections the user may add to are listed. A viewer's collection would
 * be a row that fails on save, and offering it is worse than leaving it out —
 * the same reasoning as the controls on the detail screen.
 */
export default function CollectionPicker({
  visible,
  recipeId,
  onClose,
  onSaved,
}: Props): React.JSX.Element {
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [original, setOriginal] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    async function load(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const api = await getApiClient();
        const [listRes, memberRes] = await Promise.all([
          api.collections.list(),
          api.collections.forRecipe(recipeId),
        ]);
        if ("error" in listRes) throw new Error(listRes.error.message);
        if ("error" in memberRes) throw new Error(memberRes.error.message);
        if (cancelled) return;

        setCollections(listRes.data.collections.filter((c) => permissionsFor(c.access).canEditRecipes));
        setOriginal(memberRes.data.collectionIds);
        setSelected(memberRes.data.collectionIds);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Couldn't load your collections");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [visible, recipeId]);

  function toggle(collectionId: string): void {
    setSelected((prev) =>
      prev.includes(collectionId)
        ? prev.filter((x) => x !== collectionId)
        : [...prev, collectionId],
    );
  }

  async function handleSave(): Promise<void> {
    const changes = membershipChanges(recipeId, original, selected);
    if (changes.length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const api = await getApiClient();
      // Sequential rather than parallel. These are writes to separate
      // collections, and if one fails partway it is easier to reason about
      // "the first two applied" than about an arbitrary subset.
      for (const change of changes) {
        const res = await api.collections.updateRecipes(change.collectionId, {
          add: change.add,
          remove: change.remove,
        });
        if ("error" in res) throw new Error(res.error.message);
      }
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Add to collection</Text>

          {error && <Text style={styles.error}>{error}</Text>}

          {loading ? (
            <ActivityIndicator color="#f97316" style={styles.loading} />
          ) : collections.length === 0 ? (
            <Text style={styles.empty}>
              You have no collections you can add to yet. Make one from the Menu tab.
            </Text>
          ) : (
            <ScrollView style={styles.list}>
              {collections.map((col) => {
                const isIn = selected.includes(col.id);
                return (
                  <TouchableOpacity
                    key={col.id}
                    style={styles.row}
                    onPress={() => toggle(col.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isIn }}
                  >
                    <View style={[styles.box, isIn && styles.boxChecked]}>
                      {isIn && <Text style={styles.tick}>✓</Text>}
                    </View>
                    <View style={styles.rowText}>
                      <Text style={styles.rowName} numberOfLines={1}>{col.name}</Text>
                      {col.ownerName && (
                        <Text style={styles.rowMeta}>from {col.ownerName}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.primary, saving && styles.disabled]}
              onPress={() => { void handleSave(); }}
              disabled={saving || loading}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Done</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondary} onPress={onClose} disabled={saving}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    gap: 12,
    maxHeight: "75%",
  },
  title: { fontSize: 17, fontWeight: "700", color: "#111827" },
  loading: { paddingVertical: 24 },
  empty: { fontSize: 13, color: "#9ca3af", lineHeight: 19, paddingVertical: 12 },
  list: { maxHeight: 320 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
  },
  boxChecked: { backgroundColor: "#f97316", borderColor: "#f97316" },
  tick: { color: "#fff", fontSize: 13, fontWeight: "700" },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 15, color: "#111827" },
  rowMeta: { marginTop: 1, fontSize: 12, color: "#9ca3af" },
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
