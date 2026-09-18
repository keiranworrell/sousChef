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
import { unwrap } from "@souschef/shared";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  EMPTY_SELECTION,
  canMerge,
  toggleMergeSelection,
  type MergeSelection,
} from "../../../lib/merge-selection";

type AddForm = { name: string; quantity: string; unit: string; category: string };
const emptyForm: AddForm = { name: "", quantity: "", unit: "", category: "" };

export default function ShoppingListScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [list, setList] = useState<ShoppingListWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>(emptyForm);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Off by default. The thing you do on this screen is tick items off, and
  // turning every row into a selection target would make the common action the
  // awkward one.
  const [mergeMode, setMergeMode] = useState(false);
  const [selection, setSelection] = useState<MergeSelection>(EMPTY_SELECTION);
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);

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

  function exitMergeMode(): void {
    setMergeMode(false);
    setSelection(EMPTY_SELECTION);
    setMergeError(null);
  }

  async function handleMerge(): Promise<void> {
    if (!canMerge(selection)) return;
    setMerging(true);
    setMergeError(null);
    try {
      const api = await getApiClient();
      const res = await api.shopping.items.merge(id, selection.ids, selection.name.trim());
      if ("error" in res) throw new Error(res.error.message);

      // Reload rather than patching local state. The merge deletes rows and
      // rewrites one, and reconstructing that here would be a second
      // implementation of the server's rules, free to disagree with it.
      await load();
      exitMergeMode();
    } catch (err) {
      setMergeError(err instanceof Error ? err.message : "Couldn't merge those items");
    } finally {
      setMerging(false);
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
          text: `Complete list (${checkedCount} item${checkedCount !== 1 ? "s" : ""})`,
          onPress: () => {
            Alert.alert(
              "Complete list?",
              `This will delete the list, including ${checkedCount} checked item${checkedCount !== 1 ? "s" : ""}.`,
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
                      router.replace("/(app)/shopping");
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
                    unwrap(await api.shopping.delete(id));
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
        <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={styles.formContent}>
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
          mergeMode ? (
            <View style={styles.mergeBar}>
              <Text style={styles.mergeTitle}>Merge duplicates</Text>
              <Text style={styles.mergeBlurb}>
                Pick the lines that are really the same thing. Their quantities
                are added together.
              </Text>

              {selection.ids.length > 0 && (
                <>
                  <Text style={styles.mergeLabel}>Keep this name</Text>
                  {/* The selected names as one-tap options, over a field they
                      can edit. Choosing between what is already there covers
                      most of it; the field is for when neither is right. */}
                  <View style={styles.chipRow}>
                    {list.items
                      .filter((i) => selection.ids.includes(i.id))
                      .map((i) => (
                        <TouchableOpacity
                          key={i.id}
                          style={[styles.nameChip, selection.name === i.name && styles.nameChipOn]}
                          onPress={() => setSelection((s) => ({ ...s, name: i.name }))}
                        >
                          <Text
                            style={[
                              styles.nameChipText,
                              selection.name === i.name && styles.nameChipTextOn,
                            ]}
                          >
                            {i.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                  <TextInput
                    style={styles.mergeInput}
                    value={selection.name}
                    onChangeText={(name) => setSelection((s) => ({ ...s, name }))}
                    maxLength={255}
                    accessibilityLabel="Name for the merged item"
                  />
                </>
              )}

              {mergeError && <Text style={styles.mergeErrorText}>{mergeError}</Text>}

              <View style={styles.mergeActions}>
                <TouchableOpacity
                  style={[styles.mergeBtn, (!canMerge(selection) || merging) && styles.disabled]}
                  onPress={() => { void handleMerge(); }}
                  disabled={!canMerge(selection) || merging}
                >
                  {merging ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.mergeBtnText}>
                      {selection.ids.length >= 2
                        ? `Merge ${selection.ids.length} items`
                        : "Merge"}
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.mergeCancel}
                  onPress={exitMergeMode}
                  disabled={merging}
                >
                  <Text style={styles.mergeCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>

              {selection.ids.length === 1 && (
                <Text style={styles.mergeHint}>Pick at least one more.</Text>
              )}
            </View>
          ) : (
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.addButton} onPress={() => setAdding(true)}>
                <Text style={styles.addButtonText}>+ Add item</Text>
              </TouchableOpacity>
              {/* Only offered when there is something to merge. On a list of
                  one, the button is an invitation to a dead end. */}
              {list.items.length > 1 && (
                <TouchableOpacity onPress={() => setMergeMode(true)}>
                  <Text style={styles.mergeLink}>Merge duplicates</Text>
                </TouchableOpacity>
              )}
            </View>
          )
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
                mergeMode={mergeMode}
                selected={selection.ids.includes(item.id)}
                onSelect={() =>
                  setSelection((s) => toggleMergeSelection(s, item, list.items))
                }
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
  mergeMode,
  selected,
  onSelect,
}: {
  item: ShoppingListItem;
  onToggle: (item: ShoppingListItem) => void;
  onDelete: (id: string) => void;
  toggling: boolean;
  deleting: boolean;
  mergeMode: boolean;
  selected: boolean;
  onSelect: () => void;
}): React.JSX.Element {
  /**
   * In merge mode the whole row selects, and the tick and delete controls are
   * gone. Leaving them live would put "remove this line" a thumb's width from
   * "combine this line", which is a bad place for an irreversible action.
   */
  if (mergeMode) {
    return (
      <TouchableOpacity
        style={[styles.itemRow, selected && styles.itemRowSelected]}
        onPress={onSelect}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
      >
        <View style={[styles.checkbox, selected && styles.checkboxChecked]}>
          {selected && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          {item.quantity != null && (
            <Text style={styles.itemMeta}>
              {item.quantity}{item.unit ? ` ${item.unit}` : ""}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }

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
  headerActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  mergeLink: { fontSize: 13, fontWeight: "600", color: "#6b7280", paddingHorizontal: 4, paddingVertical: 10 },
  itemRowSelected: { borderColor: "#f97316", backgroundColor: "#fff7ed" },
  mergeBar: {
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: 12,
    padding: 14,
    gap: 8,
    marginBottom: 12,
  },
  mergeTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  mergeBlurb: { fontSize: 12, color: "#9a3412", lineHeight: 17 },
  mergeLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "700",
    color: "#9a3412",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  nameChip: {
    borderWidth: 1,
    borderColor: "#fed7aa",
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  nameChipOn: { backgroundColor: "#f97316", borderColor: "#f97316" },
  nameChipText: { fontSize: 12, color: "#9a3412" },
  nameChipTextOn: { color: "#fff", fontWeight: "700" },
  mergeInput: {
    borderWidth: 1,
    borderColor: "#fed7aa",
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: "#111827",
  },
  mergeActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  mergeBtn: {
    flex: 1,
    backgroundColor: "#f97316",
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  mergeBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  mergeCancel: {
    borderWidth: 1,
    borderColor: "#fed7aa",
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  mergeCancelText: { color: "#9a3412", fontWeight: "600", fontSize: 13 },
  mergeHint: { fontSize: 12, color: "#9a3412" },
  mergeErrorText: { fontSize: 12, color: "#dc2626" },
  primaryButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  errorText: { color: "#dc2626", fontSize: 13, marginBottom: 8 },
});
