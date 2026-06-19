import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import type { Recipe } from "@souschef/shared";
import { getApiClient } from "../../../lib/api";

export default function RecipeListScreen(): React.JSX.Element {
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // URL import
  const [importVisible, setImportVisible] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const load = useCallback(async (isRefresh = false): Promise<void> => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const api = await getApiClient();
      const res = await api.recipes.list();
      if ("error" in res) throw new Error(res.error.message);
      setRecipes(res.data.recipes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recipes");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function onRefresh(): void {
    setRefreshing(true);
    void load(true);
  }

  async function handleImport(): Promise<void> {
    const url = importUrl.trim();
    if (!url) return;
    setImportError(null);
    setImportLoading(true);
    try {
      const api = await getApiClient();
      const res = await api.recipes.import({ url });
      if ("error" in res) throw new Error(res.error.message);
      setImportVisible(false);
      setImportUrl("");
      router.push(`/(app)/recipes/${res.data.id}`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f97316" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My recipes</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.importButton}
            onPress={() => {
              setImportError(null);
              setImportUrl("");
              setImportVisible(true);
            }}
          >
            <Text style={styles.importButtonText}>Import URL</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push("/(app)/recipes/new")}
          >
            <Text style={styles.addButtonText}>+ New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={recipes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={recipes.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No recipes yet.</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push("/(app)/recipes/new")}
            >
              <Text style={styles.addButtonText}>Add your first recipe</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const totalMins = (item.prepTimeMinutes ?? 0) + (item.cookTimeMinutes ?? 0);
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/(app)/recipes/${item.id}`)}
            >
              <View style={styles.cardRow}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                {item.difficulty && (
                  <Text style={styles.badge}>{item.difficulty}</Text>
                )}
              </View>
              {item.description && (
                <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
              )}
              <View style={styles.cardMeta}>
                <Text style={styles.metaText}>{item.servings} servings</Text>
                {totalMins > 0 && <Text style={styles.metaText}>{totalMins} min</Text>}
                {item.cuisine && <Text style={styles.metaText}>{item.cuisine}</Text>}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* URL import modal */}
      <Modal
        visible={importVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setImportVisible(false)}
        onShow={() => { inputRef.current?.focus(); }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Import recipe from URL</Text>
            <TextInput
              ref={inputRef}
              style={styles.modalInput}
              placeholder="https://www.example.com/recipe/..."
              value={importUrl}
              onChangeText={setImportUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              editable={!importLoading}
            />
            {importError && (
              <Text style={styles.importError}>{importError}</Text>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setImportVisible(false)}
                disabled={importLoading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addButton, (!importUrl.trim() || importLoading) && styles.disabled]}
                onPress={() => { void handleImport(); }}
                disabled={!importUrl.trim() || importLoading}
              >
                {importLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.addButtonText}>Import</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  headerActions: { flexDirection: "row", gap: 8 },
  title: { fontSize: 22, fontWeight: "700", color: "#111827" },
  list: { padding: 16, gap: 12 },
  emptyContainer: { flex: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 14, color: "#6b7280" },
  error: { color: "#dc2626", fontSize: 13, paddingHorizontal: 16, marginBottom: 8 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#e5e7eb" },
  cardRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: "600", color: "#111827" },
  badge: { backgroundColor: "#fff7ed", color: "#f97316", fontSize: 11, fontWeight: "600", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2, textTransform: "capitalize" },
  cardDesc: { marginTop: 4, fontSize: 13, color: "#6b7280" },
  cardMeta: { flexDirection: "row", gap: 12, marginTop: 8 },
  metaText: { fontSize: 12, color: "#9ca3af" },
  addButton: { backgroundColor: "#f97316", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addButtonText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  disabled: { opacity: 0.5 },
  importButton: { backgroundColor: "#fff7ed", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#fed7aa" },
  importButtonText: { color: "#f97316", fontWeight: "600", fontSize: 13 },
  // modal
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  modalSheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#111827", marginBottom: 16 },
  modalInput: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#111827", marginBottom: 8 },
  importError: { color: "#dc2626", fontSize: 13, marginBottom: 8 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  cancelButton: { flex: 1, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  cancelButtonText: { color: "#374151", fontWeight: "600", fontSize: 14 },
});
