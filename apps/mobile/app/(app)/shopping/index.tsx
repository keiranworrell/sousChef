import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import type { ShoppingList } from "@souschef/shared";
import { getApiClient } from "../../../lib/api";
import { unwrap } from "@souschef/shared";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, useThemedStyles } from "../../../components/ThemeProvider";
import type { Palette } from "../../../lib/theme";

export default function ShoppingScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const api = await getApiClient();
      const res = await api.shopping.list();
      if ("error" in res) throw new Error(res.error.message);
      setLists(res.data.lists);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load shopping lists");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(): Promise<void> {
    const name = newName.trim();
    if (!name) { setCreateError("Name is required"); return; }
    setCreateError(null);
    setCreateSaving(true);
    try {
      const api = await getApiClient();
      const res = await api.shopping.create({ name });
      if ("error" in res) throw new Error(res.error.message);
      setCreating(false);
      setNewName("");
      router.push(`/(app)/shopping/${res.data.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create list");
      setCreateSaving(false);
    }
  }

  function handleDelete(list: ShoppingList): void {
    Alert.alert("Delete list", `Delete "${list.name}"? This can't be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const api = await getApiClient();
            unwrap(await api.shopping.delete(list.id));
            setLists((prev) => prev.filter((l) => l.id !== list.id));
          } catch {
            // ignore
          }
        },
      },
    ]);
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={palette.accent} /></View>;
  }

  if (error) {
    return <View style={styles.center}><Text style={styles.errorText}>{error}</Text></View>;
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Shopping</Text>
          {!creating && (
            <TouchableOpacity style={styles.addButton} onPress={() => setCreating(true)}>
              <Text style={styles.addButtonText}>+ New list</Text>
            </TouchableOpacity>
          )}
        </View>

        {creating && (
          <View style={styles.createForm}>
            <Text style={styles.fieldLabel}>List name</Text>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Weekly shop"
              autoFocus
            />
            {createError && <Text style={styles.errorText}>{createError}</Text>}
            <View style={styles.formButtons}>
              <TouchableOpacity
                style={[styles.primaryButton, createSaving && styles.disabled]}
                onPress={() => { void handleCreate(); }}
                disabled={createSaving}
              >
                {createSaving ? (
                  <ActivityIndicator color={palette.onAccent} />
                ) : (
                  <Text style={styles.primaryButtonText}>Create list</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => { setCreating(false); setNewName(""); setCreateError(null); }}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {lists.length === 0 && !creating ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No shopping lists yet.</Text>
            <TouchableOpacity
              style={[styles.primaryButton, { marginTop: 16 }]}
              onPress={() => setCreating(true)}
            >
              <Text style={styles.primaryButtonText}>Create your first list</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={lists}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.listRow}
                onPress={() => router.push(`/(app)/shopping/${item.id}`)}
              >
                <Text style={styles.listName}>{item.name}</Text>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(item)}
                >
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  pageTitle: { fontSize: 22, fontWeight: "700", color: t.text },
  addButton: { backgroundColor: t.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addButtonText: { color: t.onAccent, fontWeight: "600", fontSize: 14 },
  createForm: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: t.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.border,
    padding: 16,
  },
  fieldLabel: { fontSize: 12, fontWeight: "500", color: t.textSecondary, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: t.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: t.text,
    backgroundColor: t.surface,
    marginBottom: 8,
  },
  formButtons: { flexDirection: "row", gap: 8 },
  primaryButton: { flex: 1, backgroundColor: t.accent, borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  disabled: { opacity: 0.5 },
  primaryButtonText: { color: t.onAccent, fontWeight: "600", fontSize: 14 },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: t.borderStrong, borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  secondaryButtonText: { color: t.textSecondary, fontWeight: "600", fontSize: 14 },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  emptyText: { fontSize: 15, color: t.textFaint, textAlign: "center" },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: t.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
  },
  listName: { flex: 1, fontSize: 15, fontWeight: "600", color: t.text },
  deleteBtn: { borderWidth: 1, borderColor: t.dangerBorder, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  deleteBtnText: { fontSize: 12, fontWeight: "500", color: t.danger },
  errorText: { color: t.danger, fontSize: 13, marginBottom: 8 },
});
