import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ShoppingListItem, ShoppingListWithItems } from "@souschef/shared";
import { getApiClient } from "../../../lib/api";

type AddForm = { name: string; quantity: string; unit: string; category: string };
const emptyForm: AddForm = { name: "", quantity: "", unit: "", category: "" };

export default function ShoppingListScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [list, setList] = useState<ShoppingListWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>(emptyForm);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [deletingList, setDeletingList] = useState(false);

  useEffect(() => {
    if (id) void load();
  }, [id]);

  async function load(): Promise<void> {
    try {
      const api = await getApiClient();
      const res = await api.shopping.get(id);
      if ("error" in res) throw new Error(res.error.message);
      setList(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load list");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddItem(): Promise<void> {
    const name = addForm.name.trim();
    if (!name) { setAddError("Name is required"); return; }
    setAddError(null);
    setAddSaving(true);
    try {
      const api = await getApiClient();
      const res = await api.shopping.items.create(id, {
        name,
        quantity: addForm.quantity ? parseFloat(addForm.quantity) : null,
        unit: addForm.unit.trim() || null,
        category: addForm.category.trim() || null,
      });
      if ("error" in res) throw new Error(res.error.message);
      setList((prev) => prev ? { ...prev, items: [...prev.items, res.data] } : prev);
      setAddForm(emptyForm);
      setAdding(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add item");
    } finally {
      setAddSaving(false);
    }
  }

  async function handleToggle(item: ShoppingListItem): Promise<void> {
    setTogglingId(item.id);
    try {
      const api = await getApiClient();
      const res = await api.shopping.items.update(id, item.id, { isChecked: !item.isChecked });
      if ("error" in res) throw new Error(res.error.message);
      setList((prev) =>
        prev ? { ...prev, items: prev.items.map((i) => (i.id === item.id ? res.data : i)) } : prev,
      );
    } catch {
      // ignore
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(itemId: string): Promise<void> {
    setDeletingId(itemId);
    try {
      const api = await getApiClient();
      await api.shopping.items.delete(id, itemId);
      setList((prev) =>
        prev ? { ...prev, items: prev.items.filter((i) => i.id !== itemId) } : prev,
      );
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  }

  function handleListActions(): void {
    const checkedCount = list?.items.filter((i) => i.isChecked).length ?? 0;
    Alert.alert(
      list?.name ?? "Shopping list",
      "What would you like to do?",
      [
        {
          text: `Complete & update pantry (${checkedCount} item${checkedCount !== 1 ? "s" : ""})`,
          onPress: () => {
            Alert.alert(
              "Update pantry?",
              `This will add ${checkedCount} checked item${checkedCount !== 1 ? "s" : ""} to your pantry and delete this list.`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Complete",
                  onPress: async () => {
                    setCompleting(true);
                    try {
                      const api = await getApiClient();
                      const res = await api.shopping.complete(id);
                      if ("error" in res) throw new Error(res.error.message);
                      router.replace("/pantry");
                    } catch (err) {
                      Alert.alert("Error", err instanceof Error ? err.message : "Something went wrong");
                    } finally {
                      setCompleting(false);
                    }
                  },
                },
              ],
            );
          },
        },
        {
          text: "Delete list",
          style: "destructive",
          onPress: () => {
            Alert.alert("Delete list?", "This can't be undone.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                  setDeletingList(true);
                  try {
                    const api = await getApiClient();
                    await api.shopping.delete(id);
                    router.replace("/shopping");
                  } catch (err) {
                    Alert.alert("Error", err instanceof Error ? err.message : "Something went wrong");
                  } finally {
                    setDeletingList(false);
                  }
                },
              },
            ]);
          },
        },
        { text: "Cancel", style: "cancel" },
      ],
    );
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#f97316" /></View>;
  }

  if (error || !list) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? "List not found"}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={styles.backLink}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const unchecked = list.items.filter((i) => !i.isChecked);
  const checked = list.items.filter((i) => i.isChecked);

  // Inline add form view
  if (adding) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView style={styles.container} contentContainerStyle={styles.formContent}>
          <TouchableOpacity onPress={() => { setAdding(false); setAddForm(emptyForm); setAddError(null); }}>
            <Text style={styles.backLink}>← Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.pageTitle}>Add item</Text>

          <Field label="Name *">
            <TextInput
              style={styles.input}
              value={addForm.name}
              onChangeText={(v) => setAddForm((p) => ({ ...p, name: v }))}
              placeholder="e.g. Bread flour"
              autoFocus
            />
          </Field>
          <View style={styles.row}>
            <Field label="Quantity" style={{ flex: 1 }}>
              <TextInput
                style={styles.input}
                value={addForm.quantity}
                onChangeText={(v) => setAddForm((p) => ({ ...p, quantity: v }))}
                placeholder="0"
                keyboardType="decimal-pad"
              />
            </Field>
            <Field label="Unit" style={{ flex: 1 }}>
              <TextInput
                style={styles.input}
                value={addForm.unit}
                onChangeText={(v) => setAddForm((p) => ({ ...p, unit: v }))}
                placeholder="kg, ml…"
              />
            </Field>
          </View>
          <Field label="Category">
            <TextInput
              style={styles.input}
              value={addForm.category}
              onChangeText={(v) => setAddForm((p) => ({ ...p, category: v }))}
              placeholder="e.g. Bakery, Dairy…"
            />
          </Field>

          {addError && <Text style={styles.errorText}>{addError}</Text>}

          <TouchableOpacity
            style={[styles.primaryButton, addSaving && styles.disabled]}
            onPress={() => { void handleAddItem(); }}
            disabled={addSaving}
          >
            {addSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Add item</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backLink}>← Lists</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleListActions}
            disabled={completing || deletingList}
            style={styles.moreBtn}
          >
            {(completing || deletingList) ? (
              <ActivityIndicator size="small" color="#f97316" />
            ) : (
              <Text style={styles.moreBtnText}>⋯</Text>
            )}
          </TouchableOpacity>
        </View>
        <Text style={styles.pageTitle}>{list.name}</Text>
        <Text style={styles.subtitle}>{unchecked.length} remaining · {checked.length} done</Text>
      </View>

      <FlatList
        data={[...unchecked, ...checked]}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <TouchableOpacity style={styles.addButton} onPress={() => setAdding(true)}>
            <Text style={styles.addButtonText}>+ Add item</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No items yet. Tap above to add one.</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const isFirstChecked = item.isChecked && (index === 0 || !unchecked[index - 1]?.isChecked);
          return (
            <>
              {isFirstChecked && checked.length > 0 && unchecked.length > 0 && (
                <Text style={styles.sectionLabel}>Done ({checked.length})</Text>
              )}
              <ItemRow
                item={item}
                onToggle={handleToggle}
                onDelete={handleDelete}
                toggling={togglingId === item.id}
                deleting={deletingId === item.id}
              />
            </>
          );
        }}
      />
    </View>
  );
}

function ItemRow({
  item,
  onToggle,
  onDelete,
  toggling,
  deleting,
}: {
  item: ShoppingListItem;
  onToggle: (item: ShoppingListItem) => void;
  onDelete: (id: string) => void;
  toggling: boolean;
  deleting: boolean;
}): React.JSX.Element {
  return (
    <View style={[styles.itemRow, item.isChecked && styles.itemRowChecked]}>
      <TouchableOpacity
        style={[styles.checkbox, item.isChecked && styles.checkboxChecked]}
        onPress={() => onToggle(item)}
        disabled={toggling}
      >
        {item.isChecked && <Text style={styles.checkmark}>✓</Text>}
      </TouchableOpacity>

      <View style={styles.itemInfo}>
        <Text style={[styles.itemName, item.isChecked && styles.itemNameChecked]}>
          {item.name}
        </Text>
        {(item.quantity != null || item.category) && (
          <Text style={styles.itemMeta}>
            {item.quantity != null ? `${item.quantity}${item.unit ? ` ${item.unit}` : ""}` : ""}
            {item.quantity != null && item.category ? " · " : ""}
            {item.category ?? ""}
          </Text>
        )}
      </View>

      <TouchableOpacity
        onPress={() => onDelete(item.id)}
        disabled={deleting}
        style={styles.removeBtn}
      >
        <Text style={styles.removeBtnText}>{deleting ? "…" : "✕"}</Text>
      </TouchableOpacity>
    </View>
  );
}

function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: object;
}): React.JSX.Element {
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f9fafb" },
  formContent: { padding: 16, paddingBottom: 40 },
  header: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  headerTop: { flexDirection: "row" as const, alignItems: "center", justifyContent: "space-between" as const, marginBottom: 8 },
  backLink: { fontSize: 14, color: "#f97316" },
  moreBtn: { padding: 4 },
  moreBtnText: { fontSize: 22, color: "#6b7280", fontWeight: "700" as const },
  pageTitle: { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 4 },
  subtitle: { fontSize: 13, color: "#9ca3af" },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyText: { fontSize: 14, color: "#9ca3af" },
  addButton: {
    backgroundColor: "#f97316",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 12,
    marginTop: 8,
  },
  addButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 6,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
    gap: 10,
  },
  itemRowChecked: { opacity: 0.55 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: "#f97316", borderColor: "#f97316" },
  checkmark: { color: "#fff", fontSize: 13, fontWeight: "700" },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: "600", color: "#111827" },
  itemNameChecked: { textDecorationLine: "line-through", color: "#9ca3af" },
  itemMeta: { fontSize: 12, color: "#9ca3af", marginTop: 1 },
  removeBtn: { padding: 4 },
  removeBtnText: { fontSize: 14, color: "#d1d5db" },
  row: { flexDirection: "row", gap: 8 },
  fieldLabel: { fontSize: 12, fontWeight: "500", color: "#374151", marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#fff",
  },
  primaryButton: { backgroundColor: "#f97316", borderRadius: 10, paddingVertical: 13, alignItems: "center", marginTop: 8 },
  disabled: { opacity: 0.5 },
  primaryButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  errorText: { color: "#dc2626", fontSize: 13, marginBottom: 8 },
});
