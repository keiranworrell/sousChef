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
  ScrollView,
} from "react-native";
import type { PantryItem, CreatePantryItemInput, UpdatePantryItemInput } from "@souschef/shared";
import { getApiClient } from "../../../lib/api";

type FormState = {
  name: string;
  quantity: string;
  unit: string;
  expiryDate: string;
  lowStockThreshold: string;
};

const emptyForm: FormState = {
  name: "",
  quantity: "",
  unit: "",
  expiryDate: "",
  lowStockThreshold: "",
};

function expiryStatus(expiryDate: string | null): "expired" | "soon" | "ok" | null {
  if (!expiryDate) return null;
  const days = Math.ceil(
    (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  if (days < 0) return "expired";
  if (days <= 3) return "soon";
  return "ok";
}

export default function PantryScreen(): React.JSX.Element {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add / edit form (null = hidden, "add" = adding, item.id = editing)
  const [formMode, setFormMode] = useState<"add" | string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const api = await getApiClient();
      const res = await api.pantry.list();
      if ("error" in res) throw new Error(res.error.message);
      setItems(res.data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pantry");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openAdd(): void {
    setForm(emptyForm);
    setFormError(null);
    setFormMode("add");
  }

  function openEdit(item: PantryItem): void {
    setForm({
      name: item.name,
      quantity: item.quantity != null ? String(item.quantity) : "",
      unit: item.unit ?? "",
      expiryDate: item.expiryDate ? item.expiryDate.slice(0, 10) : "",
      lowStockThreshold: item.lowStockThreshold != null ? String(item.lowStockThreshold) : "",
    });
    setFormError(null);
    setFormMode(item.id);
  }

  function closeForm(): void {
    setFormMode(null);
    setForm(emptyForm);
    setFormError(null);
  }

  async function handleSave(): Promise<void> {
    if (!form.name.trim()) { setFormError("Name is required"); return; }
    setFormError(null);
    setSaving(true);
    try {
      const api = await getApiClient();
      if (formMode === "add") {
        const input: CreatePantryItemInput = {
          name: form.name.trim(),
          quantity: form.quantity ? parseFloat(form.quantity) : null,
          unit: form.unit.trim() || null,
          expiryDate: form.expiryDate || null,
          lowStockThreshold: form.lowStockThreshold ? parseFloat(form.lowStockThreshold) : null,
        };
        const res = await api.pantry.create(input);
        if ("error" in res) throw new Error(res.error.message);
        setItems((prev) => [res.data, ...prev]);
      } else if (formMode) {
        const input: UpdatePantryItemInput = {
          name: form.name.trim(),
          quantity: form.quantity ? parseFloat(form.quantity) : null,
          unit: form.unit.trim() || null,
          expiryDate: form.expiryDate || null,
          lowStockThreshold: form.lowStockThreshold ? parseFloat(form.lowStockThreshold) : null,
        };
        const res = await api.pantry.update(formMode, input);
        if ("error" in res) throw new Error(res.error.message);
        setItems((prev) => prev.map((i) => (i.id === formMode ? res.data : i)));
      }
      closeForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(item: PantryItem): void {
    Alert.alert("Remove item", `Remove "${item.name}" from your pantry?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            const api = await getApiClient();
            await api.pantry.delete(item.id);
            setItems((prev) => prev.filter((i) => i.id !== item.id));
          } catch {
            // ignore
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f97316" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  // Inline form (add or edit)
  if (formMode !== null) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <Text style={styles.pageTitle}>
            {formMode === "add" ? "Add item" : "Edit item"}
          </Text>

          <Field label="Name *">
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
              placeholder="e.g. Sourdough starter"
              autoFocus
            />
          </Field>

          <View style={styles.row}>
            <Field label="Quantity" style={{ flex: 1 }}>
              <TextInput
                style={styles.input}
                value={form.quantity}
                onChangeText={(v) => setForm((p) => ({ ...p, quantity: v }))}
                placeholder="0"
                keyboardType="decimal-pad"
              />
            </Field>
            <Field label="Unit" style={{ flex: 1 }}>
              <TextInput
                style={styles.input}
                value={form.unit}
                onChangeText={(v) => setForm((p) => ({ ...p, unit: v }))}
                placeholder="g, ml, bags…"
              />
            </Field>
          </View>

          <Field label="Expiry date (YYYY-MM-DD)">
            <TextInput
              style={styles.input}
              value={form.expiryDate}
              onChangeText={(v) => setForm((p) => ({ ...p, expiryDate: v }))}
              placeholder="2026-12-31"
              keyboardType="numbers-and-punctuation"
            />
          </Field>

          <Field label="Low stock alert below">
            <TextInput
              style={styles.input}
              value={form.lowStockThreshold}
              onChangeText={(v) => setForm((p) => ({ ...p, lowStockThreshold: v }))}
              placeholder="e.g. 100"
              keyboardType="decimal-pad"
            />
          </Field>

          {formError && <Text style={styles.errorText}>{formError}</Text>}

          <View style={styles.formButtons}>
            <TouchableOpacity
              style={[styles.primaryButton, saving && styles.disabled]}
              onPress={() => { void handleSave(); }}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {formMode === "add" ? "Add item" : "Save changes"}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={closeForm}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Pantry</Text>
        <TouchableOpacity style={styles.addButton} onPress={openAdd}>
          <Text style={styles.addButtonText}>+ Add item</Text>
        </TouchableOpacity>
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Your pantry is empty.</Text>
          <TouchableOpacity style={[styles.primaryButton, { marginTop: 16 }]} onPress={openAdd}>
            <Text style={styles.primaryButtonText}>Add your first item</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <PantryItemRow item={item} onEdit={openEdit} onDelete={handleDelete} />}
        />
      )}
    </View>
  );
}

function PantryItemRow({
  item,
  onEdit,
  onDelete,
}: {
  item: PantryItem;
  onEdit: (item: PantryItem) => void;
  onDelete: (item: PantryItem) => void;
}): React.JSX.Element {
  const status = expiryStatus(item.expiryDate);
  const isLowStock =
    item.lowStockThreshold != null &&
    item.quantity != null &&
    item.quantity <= item.lowStockThreshold;

  return (
    <View style={styles.itemRow}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        <View style={styles.itemMeta}>
          {item.quantity != null && (
            <Text style={styles.itemQty}>
              {item.quantity}{item.unit ? ` ${item.unit}` : ""}
            </Text>
          )}
          {status === "expired" && (
            <Text style={[styles.badge, styles.badgeRed]}>Expired</Text>
          )}
          {status === "soon" && (
            <Text style={[styles.badge, styles.badgeOrange]}>
              Expires {new Date(item.expiryDate!).toLocaleDateString()}
            </Text>
          )}
          {isLowStock && (
            <Text style={[styles.badge, styles.badgeYellow]}>Low stock</Text>
          )}
        </View>
      </View>
      <View style={styles.itemActions}>
        <TouchableOpacity onPress={() => onEdit(item)} style={styles.actionBtn}>
          <Text style={styles.actionBtnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onDelete(item)} style={[styles.actionBtn, styles.actionBtnDanger]}>
          <Text style={[styles.actionBtnText, styles.actionBtnDangerText]}>Remove</Text>
        </TouchableOpacity>
      </View>
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
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f9fafb" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  pageTitle: { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 20 },
  addButton: { backgroundColor: "#f97316", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addButtonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  emptyText: { fontSize: 15, color: "#9ca3af", textAlign: "center" },
  itemRow: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  itemInfo: { flex: 1, gap: 4 },
  itemName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  itemMeta: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  itemQty: { fontSize: 13, color: "#6b7280" },
  badge: { fontSize: 11, fontWeight: "600", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 },
  badgeRed: { backgroundColor: "#fef2f2", color: "#dc2626" },
  badgeOrange: { backgroundColor: "#fff7ed", color: "#ea580c" },
  badgeYellow: { backgroundColor: "#fefce8", color: "#ca8a04" },
  itemActions: { flexDirection: "row", gap: 6 },
  actionBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionBtnText: { fontSize: 12, fontWeight: "500", color: "#374151" },
  actionBtnDanger: { borderColor: "#fecaca" },
  actionBtnDangerText: { color: "#dc2626" },
  row: { flexDirection: "row", gap: 8 },
  field: { marginBottom: 14 },
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
  formButtons: { gap: 10, marginTop: 8 },
  primaryButton: { backgroundColor: "#f97316", borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  disabled: { opacity: 0.5 },
  primaryButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#374151", fontWeight: "600", fontSize: 15 },
  errorText: { color: "#dc2626", fontSize: 13, marginBottom: 12 },
});
