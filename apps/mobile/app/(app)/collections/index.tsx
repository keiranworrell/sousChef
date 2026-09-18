import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import type { CollectionSummary } from "@souschef/shared";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getApiClient } from "../../../lib/api";
import { TAB_BAR_ALLOWANCE } from "../../../lib/tab-bar";
import { useTheme, useThemedStyles } from "../../../components/ThemeProvider";
import type { Palette } from "../../../lib/theme";

export default function CollectionsScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const api = await getApiClient();
      const res = await api.collections.list();
      if ("error" in res) throw new Error(res.error.message);
      setCollections(res.data.collections);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your collections");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reloads whenever the screen comes back into focus, not just on mount.
  // Adding or removing recipes happens on other screens, and a stale count
  // here is the kind of wrongness nobody reports — they just quietly stop
  // trusting the number.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function handleCreate(): Promise<void> {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    setCreateError(null);
    try {
      const api = await getApiClient();
      const res = await api.collections.create({ name });
      if ("error" in res) throw new Error(res.error.message);
      setCreating(false);
      setNewName("");
      router.push(`/(app)/collections/${res.data.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Couldn't create that collection");
    } finally {
      setSaving(false);
    }
  }

  // Split on the server's access field rather than by comparing user ids.
  // The server already decided; recomputing that decision on the client is a
  // second implementation of the same rule, free to disagree with it.
  const own = collections.filter((c) => c.access === "owner");
  const shared = collections.filter((c) => c.access !== "owner");

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  const sections = [
    { key: "own", title: "Your collections", data: own },
    { key: "shared", title: "Shared with you", data: shared },
  ].filter((s) => s.data.length > 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Collections</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => { setCreateError(null); setCreating(true); }}>
          <Text style={styles.addButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={sections}
        keyExtractor={(s) => s.key}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + TAB_BAR_ALLOWANCE },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void load(); }}
            tintColor={palette.accent}
          />
        }
        ListEmptyComponent={
          !error ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No collections yet.</Text>
              <Text style={styles.emptyHint}>
                Collections group recipes together — a week of dinners, everything
                you bake, a menu you cook for people.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item: section }) => (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.data.map((col) => (
              <TouchableOpacity
                key={col.id}
                style={styles.card}
                onPress={() => router.push(`/(app)/collections/${col.id}`)}
              >
                {col.coverImageUrl ? (
                  <Image
                    source={{ uri: col.coverImageUrl }}
                    style={styles.cover}
                    resizeMode="cover"
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <View style={[styles.cover, styles.coverEmpty]} />
                )}
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{col.name}</Text>
                  <Text style={styles.cardMeta}>
                    {col.recipeCount} {col.recipeCount === 1 ? "recipe" : "recipes"}
                    {/* Who it came from and what you can do with it. A viewer
                        finding out only when an edit control does nothing is
                        worse than being told up front. */}
                    {col.ownerName ? ` · from ${col.ownerName}` : ""}
                    {col.access === "viewer" ? " · view only" : ""}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      />

      <Modal visible={creating} transparent animationType="slide" onRequestClose={() => setCreating(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>New collection</Text>
            <TextInput
              style={styles.input}
              placeholder="Weeknight dinners"
              placeholderTextColor={palette.textFaint}
              value={newName}
              onChangeText={setNewName}
              autoFocus
              maxLength={255}
            />
            {createError && <Text style={styles.error}>{createError}</Text>}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.primary, (saving || !newName.trim()) && styles.disabled]}
                onPress={() => { void handleCreate(); }}
                disabled={saving || !newName.trim()}
              >
                {saving ? <ActivityIndicator color={palette.onAccent} /> : <Text style={styles.primaryText}>Create</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondary} onPress={() => setCreating(false)} disabled={saving}>
                <Text style={styles.secondaryText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  center: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  title: { fontSize: 24, fontWeight: "700", color: t.text },
  addButton: { backgroundColor: t.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addButtonText: { color: t.onAccent, fontWeight: "600", fontSize: 13 },
  list: { padding: 16, gap: 20 },
  section: { gap: 10 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: t.textFaint,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: t.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.border,
    padding: 10,
  },
  cover: { width: 56, height: 56, borderRadius: 8, backgroundColor: t.surfaceSunken },
  coverEmpty: { borderWidth: 1, borderColor: t.border },
  cardText: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: t.text },
  cardMeta: { marginTop: 2, fontSize: 12, color: t.textFaint },
  empty: { paddingVertical: 48, paddingHorizontal: 24, alignItems: "center", gap: 8 },
  emptyText: { fontSize: 15, fontWeight: "600", color: t.textSecondary },
  emptyHint: { fontSize: 13, color: t.textFaint, textAlign: "center", lineHeight: 19 },
  error: { marginHorizontal: 16, color: t.danger, fontSize: 13 },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: t.overlay },
  modalSheet: { backgroundColor: t.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, gap: 12 },
  modalTitle: { fontSize: 17, fontWeight: "700", color: t.text },
  input: {
    borderWidth: 1,
    borderColor: t.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: t.text,
  },
  modalActions: { flexDirection: "row", gap: 10 },
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
