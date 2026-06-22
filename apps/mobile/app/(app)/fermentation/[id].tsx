import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type {
  FermentationBatchWithLogs,
  FermentationLog,
  FermentationStatus,
} from "@souschef/shared";
import { getApiClient } from "../../../lib/api";

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function StatusBadge({ status }: { status: FermentationStatus }): React.JSX.Element {
  const config: Record<FermentationStatus, { label: string; bg: string; color: string }> = {
    active: { label: "Active", bg: "#fff7ed", color: "#ea580c" },
    complete: { label: "Complete", bg: "#f0fdf4", color: "#16a34a" },
    abandoned: { label: "Abandoned", bg: "#f9fafb", color: "#9ca3af" },
  };
  const { label, bg, color } = config[status];
  return <Text style={[styles.badge, { backgroundColor: bg, color }]}>{label}</Text>;
}

type LogFormState = {
  ph: string;
  saltPercent: string;
  temperatureCelsius: string;
  weightGrams: string;
  notes: string;
};

const emptyLogForm: LogFormState = {
  ph: "", saltPercent: "", temperatureCelsius: "", weightGrams: "", notes: "",
};

export default function BatchDetailScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [batch, setBatch] = useState<FermentationBatchWithLogs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addingLog, setAddingLog] = useState(false);
  const [logForm, setLogForm] = useState<LogFormState>(emptyLogForm);
  const [logSaving, setLogSaving] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);

  useEffect(() => {
    if (id) void load();
  }, [id]);

  async function load(): Promise<void> {
    try {
      const api = await getApiClient();
      const res = await api.fermentation.get(id);
      if ("error" in res) throw new Error(res.error.message);
      setBatch(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load batch");
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(status: FermentationStatus): Promise<void> {
    if (!batch) return;
    setUpdatingStatus(true);
    try {
      const api = await getApiClient();
      const res = await api.fermentation.update(batch.id, { status });
      if ("error" in res) throw new Error(res.error.message);
      setBatch((prev) => prev ? { ...prev, status: res.data.status } : prev);
    } catch {
      // ignore
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleAddLog(): Promise<void> {
    if (!batch) return;
    const hasData =
      logForm.ph || logForm.saltPercent || logForm.temperatureCelsius ||
      logForm.weightGrams || logForm.notes.trim();
    if (!hasData) { setLogError("Add at least one measurement or note"); return; }
    setLogError(null);
    setLogSaving(true);
    try {
      const api = await getApiClient();
      const res = await api.fermentation.logs.create(batch.id, {
        ph: logForm.ph ? parseFloat(logForm.ph) : null,
        saltPercent: logForm.saltPercent ? parseFloat(logForm.saltPercent) : null,
        temperatureCelsius: logForm.temperatureCelsius ? parseFloat(logForm.temperatureCelsius) : null,
        weightGrams: logForm.weightGrams ? parseFloat(logForm.weightGrams) : null,
        notes: logForm.notes.trim() || null,
      });
      if ("error" in res) throw new Error(res.error.message);
      setBatch((prev) =>
        prev ? { ...prev, logs: [...prev.logs, res.data] } : prev,
      );
      setLogForm(emptyLogForm);
      setAddingLog(false);
    } catch (err) {
      setLogError(err instanceof Error ? err.message : "Failed to add log");
    } finally {
      setLogSaving(false);
    }
  }

  async function handleDeleteLog(log: FermentationLog): Promise<void> {
    if (!batch) return;
    setDeletingLogId(log.id);
    try {
      const api = await getApiClient();
      await api.fermentation.logs.delete(batch.id, log.id);
      setBatch((prev) =>
        prev ? { ...prev, logs: prev.logs.filter((l) => l.id !== log.id) } : prev,
      );
    } catch {
      // ignore
    } finally {
      setDeletingLogId(null);
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#f97316" /></View>;
  }

  if (error || !batch) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? "Batch not found"}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={styles.backLink}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const days = daysAgo(batch.startedAt);
  const remaining = batch.targetEndDate ? daysUntil(batch.targetEndDate) : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>← Fermentation</Text>
        </TouchableOpacity>
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>{batch.name}</Text>
          <StatusBadge status={batch.status} />
        </View>
        <Text style={styles.meta}>
          Day {days}
          {remaining !== null
            ? remaining >= 0
              ? ` · ${remaining}d remaining`
              : ` · ${Math.abs(remaining)}d past target`
            : ""}
          {batch.targetEndDate
            ? ` · target ${new Date(batch.targetEndDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
            : ""}
        </Text>

        {/* Status controls */}
        {batch.status === "active" && (
          <View style={styles.statusButtons}>
            <TouchableOpacity
              style={[styles.statusBtn, styles.statusBtnGreen, updatingStatus && styles.disabled]}
              onPress={() => { void handleStatusChange("complete"); }}
              disabled={updatingStatus}
            >
              <Text style={[styles.statusBtnText, { color: "#16a34a" }]}>Mark complete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.statusBtn, styles.statusBtnGray, updatingStatus && styles.disabled]}
              onPress={() => { void handleStatusChange("abandoned"); }}
              disabled={updatingStatus}
            >
              <Text style={[styles.statusBtnText, { color: "#6b7280" }]}>Abandon</Text>
            </TouchableOpacity>
          </View>
        )}
        {(batch.status === "complete" || batch.status === "abandoned") && (
          <TouchableOpacity
            style={[styles.statusBtn, styles.statusBtnOrange, updatingStatus && styles.disabled]}
            onPress={() => { void handleStatusChange("active"); }}
            disabled={updatingStatus}
          >
            <Text style={[styles.statusBtnText, { color: "#f97316" }]}>Reactivate</Text>
          </TouchableOpacity>
        )}

        {/* Add log */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Log entries</Text>
          {!addingLog && (
            <TouchableOpacity onPress={() => setAddingLog(true)}>
              <Text style={styles.addLogLink}>+ Add entry</Text>
            </TouchableOpacity>
          )}
        </View>

        {addingLog && (
          <View style={styles.logForm}>
            <Text style={styles.logFormTitle}>New log entry</Text>
            <View style={styles.row}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>pH</Text>
                <TextInput
                  style={styles.input}
                  value={logForm.ph}
                  onChangeText={(v) => setLogForm((p) => ({ ...p, ph: v }))}
                  placeholder="3.5"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Salt %</Text>
                <TextInput
                  style={styles.input}
                  value={logForm.saltPercent}
                  onChangeText={(v) => setLogForm((p) => ({ ...p, saltPercent: v }))}
                  placeholder="2.0"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Temp (°C)</Text>
                <TextInput
                  style={styles.input}
                  value={logForm.temperatureCelsius}
                  onChangeText={(v) => setLogForm((p) => ({ ...p, temperatureCelsius: v }))}
                  placeholder="21"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Weight (g)</Text>
                <TextInput
                  style={styles.input}
                  value={logForm.weightGrams}
                  onChangeText={(v) => setLogForm((p) => ({ ...p, weightGrams: v }))}
                  placeholder="450"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={logForm.notes}
                onChangeText={(v) => setLogForm((p) => ({ ...p, notes: v }))}
                placeholder="Observations, smell, texture…"
                multiline
                numberOfLines={3}
              />
            </View>
            {logError && <Text style={styles.errorText}>{logError}</Text>}
            <View style={styles.formButtons}>
              <TouchableOpacity
                style={[styles.primaryButton, { flex: 1 }, logSaving && styles.disabled]}
                onPress={() => { void handleAddLog(); }}
                disabled={logSaving}
              >
                {logSaving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.primaryButtonText}>Save entry</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryButton, { flex: 1 }]}
                onPress={() => { setAddingLog(false); setLogForm(emptyLogForm); setLogError(null); }}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Timeline */}
        {batch.logs.length === 0 && !addingLog && (
          <Text style={styles.emptyLogs}>No log entries yet. Tap "+ Add entry" to start tracking.</Text>
        )}
        {[...batch.logs].reverse().map((log, i) => (
          <View key={log.id} style={[styles.logEntry, i === 0 && styles.logEntryFirst]}>
            <View style={styles.logEntryHeader}>
              <Text style={styles.logDate}>
                {new Date(log.loggedAt).toLocaleDateString("en-GB", {
                  day: "numeric", month: "short", year: "numeric",
                })}
              </Text>
              <TouchableOpacity
                onPress={() => { void handleDeleteLog(log); }}
                disabled={deletingLogId === log.id}
              >
                <Text style={styles.deleteLogText}>
                  {deletingLogId === log.id ? "…" : "Remove"}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.logMeasurements}>
              {log.ph != null && <Measurement label="pH" value={String(log.ph)} />}
              {log.saltPercent != null && <Measurement label="Salt" value={`${log.saltPercent}%`} />}
              {log.temperatureCelsius != null && <Measurement label="Temp" value={`${log.temperatureCelsius}°C`} />}
              {log.weightGrams != null && <Measurement label="Weight" value={`${log.weightGrams}g`} />}
            </View>
            {log.notes && <Text style={styles.logNotes}>{log.notes}</Text>}
          </View>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Measurement({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={styles.measurement}>
      <Text style={styles.measurementLabel}>{label}</Text>
      <Text style={styles.measurementValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f9fafb" },
  content: { padding: 16, paddingBottom: 60 },
  backLink: { fontSize: 14, color: "#f97316", marginBottom: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 },
  pageTitle: { fontSize: 22, fontWeight: "700", color: "#111827" },
  badge: { fontSize: 11, fontWeight: "600", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  meta: { fontSize: 13, color: "#9ca3af", marginBottom: 16 },
  statusButtons: { flexDirection: "row", gap: 8, marginBottom: 20 },
  statusBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  statusBtnGreen: { borderColor: "#bbf7d0" },
  statusBtnGray: { borderColor: "#e5e7eb" },
  statusBtnOrange: { borderColor: "#fed7aa", marginBottom: 20 },
  statusBtnText: { fontSize: 13, fontWeight: "600" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  addLogLink: { fontSize: 14, fontWeight: "600", color: "#f97316" },
  logForm: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    marginBottom: 16,
  },
  logFormTitle: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 12 },
  row: { flexDirection: "row", gap: 8 },
  field: { marginBottom: 10 },
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
  multiline: { minHeight: 72, textAlignVertical: "top" },
  formButtons: { flexDirection: "row", gap: 8, marginTop: 4 },
  primaryButton: { backgroundColor: "#f97316", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  disabled: { opacity: 0.5 },
  primaryButtonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  secondaryButton: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  secondaryButtonText: { color: "#374151", fontWeight: "600", fontSize: 14 },
  errorText: { color: "#dc2626", fontSize: 13, marginBottom: 8 },
  emptyLogs: { fontSize: 13, color: "#9ca3af", fontStyle: "italic", marginTop: 4, marginBottom: 20 },
  logEntry: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    marginBottom: 8,
  },
  logEntryFirst: { borderColor: "#fed7aa" },
  logEntryHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  logDate: { fontSize: 13, fontWeight: "600", color: "#374151" },
  deleteLogText: { fontSize: 12, color: "#d1d5db" },
  logMeasurements: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  measurement: { backgroundColor: "#f9fafb", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  measurementLabel: { fontSize: 10, fontWeight: "600", color: "#9ca3af", textTransform: "uppercase" },
  measurementValue: { fontSize: 13, fontWeight: "700", color: "#111827" },
  logNotes: { fontSize: 13, color: "#6b7280", marginTop: 4, lineHeight: 18 },
});
