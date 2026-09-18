import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import type { FermentationBatch, FermentationStatus } from "@souschef/shared";
import { getApiClient } from "../../../lib/api";
import { unwrap } from "@souschef/shared";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, useThemedStyles } from "../../../components/ThemeProvider";
import type { Palette } from "../../../lib/theme";

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function StatusBadge({ status }: { status: FermentationStatus }): React.JSX.Element {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const config: Record<FermentationStatus, { label: string; bg: string; color: string }> = {
    active: { label: "Active", bg: palette.accentSurface, color: palette.accentStrong },
    complete: { label: "Complete", bg: palette.successSurface, color: palette.success },
    abandoned: { label: "Abandoned", bg: palette.surfaceSunken, color: palette.textFaint },
  };
  const { label, bg, color } = config[status];
  return (
    <Text style={[styles.badge, { backgroundColor: bg, color }]}>{label}</Text>
  );
}

export default function FermentationScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [batches, setBatches] = useState<FermentationBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [startedAt, setStartedAt] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [targetEndDate, setTargetEndDate] = useState("");
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const api = await getApiClient();
      const res = await api.fermentation.list();
      if ("error" in res) throw new Error(res.error.message);
      setBatches(res.data.batches);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load batches");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(): Promise<void> {
    if (!name.trim()) { setCreateError("Name is required"); return; }
    setCreateError(null);
    setCreateSaving(true);
    try {
      const api = await getApiClient();
      const res = await api.fermentation.create({
        name: name.trim(),
        startedAt: new Date(startedAt).toISOString(),
        targetEndDate: targetEndDate ? new Date(targetEndDate).toISOString() : null,
      });
      if ("error" in res) throw new Error(res.error.message);
      setCreating(false);
      setName("");
      setStartedAt(new Date().toISOString().slice(0, 10));
      setTargetEndDate("");
      router.push(`/(app)/fermentation/${res.data.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create batch");
      setCreateSaving(false);
    }
  }

  function handleDelete(batch: FermentationBatch): void {
    Alert.alert("Delete batch", `Delete "${batch.name}"? All logs will be lost.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const api = await getApiClient();
            unwrap(await api.fermentation.delete(batch.id));
            setBatches((prev) => prev.filter((b) => b.id !== batch.id));
          } catch {
            // ignore
          }
        },
      },
    ]);
  }

  if (creating) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={styles.formContent}>
          <TouchableOpacity onPress={() => { setCreating(false); setCreateError(null); }}>
            <Text style={styles.backLink}>← Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.pageTitle}>New batch</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Sourdough starter, Kimchi #3"
              autoFocus
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Started (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={startedAt}
              onChangeText={setStartedAt}
              placeholder="2026-06-22"
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Target end date (optional)</Text>
            <TextInput
              style={styles.input}
              value={targetEndDate}
              onChangeText={setTargetEndDate}
              placeholder="2026-07-22"
              keyboardType="numbers-and-punctuation"
            />
          </View>

          {createError && <Text style={styles.errorText}>{createError}</Text>}

          <TouchableOpacity
            style={[styles.primaryButton, createSaving && styles.disabled]}
            onPress={() => { void handleCreate(); }}
            disabled={createSaving}
          >
            {createSaving
              ? <ActivityIndicator color={palette.onAccent} />
              : <Text style={styles.primaryButtonText}>Start batch</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={palette.accent} /></View>;
  }

  if (error) {
    return <View style={styles.center}><Text style={styles.errorText}>{error}</Text></View>;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Fermentation</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setCreating(true)}>
          <Text style={styles.addButtonText}>+ New batch</Text>
        </TouchableOpacity>
      </View>

      {batches.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No batches yet.</Text>
          <TouchableOpacity
            style={[styles.primaryButton, { marginTop: 16 }]}
            onPress={() => setCreating(true)}
          >
            <Text style={styles.primaryButtonText}>Start your first batch</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={batches}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.batchRow}
              onPress={() => router.push(`/(app)/fermentation/${item.id}`)}
            >
              <View style={styles.batchInfo}>
                <View style={styles.batchTitleRow}>
                  <Text style={styles.batchName}>{item.name}</Text>
                  <StatusBadge status={item.status} />
                </View>
                <Text style={styles.batchMeta}>
                  Day {daysAgo(item.startedAt)}
                  {item.targetEndDate
                    ? ` · ends ${new Date(item.targetEndDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                    : ""}
                </Text>
              </View>
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
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.bg },
  formContent: { padding: 16, paddingBottom: 40 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  pageTitle: { fontSize: 22, fontWeight: "700", color: t.text, marginBottom: 20 },
  addButton: { backgroundColor: t.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addButtonText: { color: t.onAccent, fontWeight: "600", fontSize: 14 },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  emptyText: { fontSize: 15, color: t.textFaint, textAlign: "center" },
  batchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: t.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 10,
  },
  batchInfo: { flex: 1, gap: 4 },
  batchTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  batchName: { fontSize: 15, fontWeight: "600", color: t.text },
  batchMeta: { fontSize: 12, color: t.textFaint },
  badge: { fontSize: 11, fontWeight: "600", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 },
  deleteBtn: { borderWidth: 1, borderColor: t.dangerBorder, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  deleteBtnText: { fontSize: 12, fontWeight: "500", color: t.danger },
  backLink: { fontSize: 14, color: t.accent, marginBottom: 8 },
  field: { marginBottom: 14 },
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
  },
  primaryButton: { backgroundColor: t.accent, borderRadius: 10, paddingVertical: 13, alignItems: "center", marginTop: 8 },
  disabled: { opacity: 0.5 },
  primaryButtonText: { color: t.onAccent, fontWeight: "600", fontSize: 15 },
  errorText: { color: t.danger, fontSize: 13, marginBottom: 8 },
});
