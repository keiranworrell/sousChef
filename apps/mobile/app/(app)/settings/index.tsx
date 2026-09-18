import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { signOut, updatePassword } from "aws-amplify/auth";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { User } from "@souschef/shared";
import { getApiClient } from "../../../lib/api";
import { exportFileName } from "../../../lib/data-export";
import { TAB_BAR_ALLOWANCE } from "../../../lib/tab-bar";


export default function SettingsScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Change password
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwDone, setPwDone] = useState(false);

  // Export
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Delete account
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const api = await getApiClient();
        const res = await api.users.me();
        if ("error" in res) throw new Error(res.error.message);
        setUser(res.data);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Couldn't load your account");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  /**
   * A copy of the user's data, handed to the system share sheet.
   *
   * There is no "downloads folder" to put it in, so the phone equivalent of
   * web's download is: write the JSON to the cache, then let the user send it
   * wherever they keep things — Drive, email, Files. The obligation under
   * Article 20 is that they can get it and take it elsewhere, which this does.
   *
   * Written to cache rather than documents deliberately. This is a copy for
   * export, not app data: once it has been shared the system is welcome to
   * reclaim it, and leaving personal data sitting in app storage indefinitely
   * is the opposite of what an export is for.
   */
  async function handleExport(): Promise<void> {
    setExporting(true);
    setExportError(null);
    let file: File | null = null;
    try {
      const api = await getApiClient();
      const res = await api.users.exportData();
      if ("error" in res) throw new Error(res.error.message);

      // Checked before writing anything: a device with no share target would
      // otherwise get a file written and nothing to do with it.
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error("This device has no way to share a file.");
      }

      file = new File(Paths.cache, exportFileName());
      if (file.exists) file.delete();
      file.create();
      // Indented, like web's download. This is meant to be readable by the
      // person who asked for it, not only by a parser.
      file.write(JSON.stringify(res.data, null, 2));

      await Sharing.shareAsync(file.uri, {
        mimeType: "application/json",
        dialogTitle: "Your sousChef data",
        UTI: "public.json",
      });
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Couldn't export your data");
    } finally {
      setExporting(false);
    }
  }

  async function handleChangePassword(): Promise<void> {
    if (!oldPassword || !newPassword) return;
    setPwSaving(true);
    setPwError(null);
    setPwDone(false);
    try {
      // Straight to Cognito. The password never reaches our backend, which is
      // the point — we have no route that takes one and should not add one.
      await updatePassword({ oldPassword, newPassword });
      setOldPassword("");
      setNewPassword("");
      setPwDone(true);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Couldn't change your password");
    } finally {
      setPwSaving(false);
    }
  }

  function confirmDelete(): void {
    Alert.alert(
      "Delete your account?",
      "Every recipe, list, meal plan and cook log goes with it. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => { void handleDelete(); } },
      ],
    );
  }

  async function handleDelete(): Promise<void> {
    setDeleting(true);
    setDeleteError(null);
    try {
      const api = await getApiClient();
      const res = await api.users.deleteAccount();
      if ("error" in res) throw new Error(res.error.message);
      // Clears the local session. The root layout hears `signedOut` and routes
      // to sign-in; without this the app would sit on a settings screen for an
      // account that no longer exists.
      await signOut();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Couldn't delete your account");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color="#f97316" />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + TAB_BAR_ALLOWANCE },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Settings</Text>

      {loadError && <Text style={styles.error}>{loadError}</Text>}

      {user && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <Row label="Name" value={user.displayName} />
            <Row label="Email" value={user.email} />
            <Row label="Plan" value={user.planTier === "premium" ? "Premium" : "Free"} />
            {/* Null means premium — no limit — rather than none left, so the
                counter is only meaningful on a free plan. */}
            {user.aiImportsRemaining !== null && (
              <Row
                label="AI imports left"
                value={String(user.aiImportsRemaining)}
                last
              />
            )}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Change password</Text>
        <View style={styles.card}>
          <TextInput
            style={styles.input}
            placeholder="Current password"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            autoComplete="current-password"
            value={oldPassword}
            onChangeText={setOldPassword}
          />
          <TextInput
            style={styles.input}
            placeholder="New password"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            autoComplete="new-password"
            value={newPassword}
            onChangeText={setNewPassword}
          />
          {pwError && <Text style={styles.error}>{pwError}</Text>}
          {pwDone && <Text style={styles.success}>Password changed.</Text>}
          <TouchableOpacity
            style={[styles.button, (pwSaving || !oldPassword || !newPassword) && styles.buttonDisabled]}
            onPress={() => { void handleChangePassword(); }}
            disabled={pwSaving || !oldPassword || !newPassword}
          >
            {pwSaving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Change password</Text>}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your data</Text>
        <View style={styles.card}>
          <Text style={styles.note}>
            A copy of everything sousChef holds about you — recipes, plans,
            lists, cook log — as a JSON file you can keep or move elsewhere.
          </Text>
          {exportError && <Text style={styles.error}>{exportError}</Text>}
          <TouchableOpacity
            style={[styles.secondaryBtn, exporting && styles.buttonDisabled]}
            onPress={() => { void handleExport(); }}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator color="#ea580c" size="small" />
            ) : (
              <Text style={styles.secondaryBtnText}>Download your data</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Danger zone</Text>
        <View style={[styles.card, styles.dangerCard]}>
          <Text style={styles.note}>
            Deleting your account removes every recipe, list, meal plan and cook log.
            It cannot be undone.
          </Text>
          {/* Typing the word, then confirming in a dialog. Deletion is
              irreversible and reachable in two taps from the menu, so it should
              not be possible to do it by accident with one of them. */}
          <TextInput
            style={styles.input}
            placeholder='Type DELETE to confirm'
            placeholderTextColor="#9ca3af"
            autoCapitalize="characters"
            autoCorrect={false}
            value={deleteConfirm}
            onChangeText={setDeleteConfirm}
          />
          {deleteError && <Text style={styles.error}>{deleteError}</Text>}
          <TouchableOpacity
            style={[styles.dangerButton, (deleting || deleteConfirm !== "DELETE") && styles.buttonDisabled]}
            onPress={confirmDelete}
            disabled={deleting || deleteConfirm !== "DELETE"}
          >
            {deleting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Delete my account</Text>}
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={styles.signOut}
        // No navigation: the root layout routes on the `signedOut` event.
        onPress={() => { void signOut(); }}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Row({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}): React.JSX.Element {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 20 },
  title: { fontSize: 24, fontWeight: "700", color: "#111827", marginTop: 4 },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    gap: 10,
  },
  dangerCard: { borderColor: "#fecaca" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  rowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  rowLabel: { fontSize: 14, color: "#6b7280" },
  rowValue: { flex: 1, textAlign: "right", fontSize: 14, fontWeight: "500", color: "#111827" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
  },
  button: {
    backgroundColor: "#f97316",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  dangerButton: {
    backgroundColor: "#dc2626",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#fed7aa",
    backgroundColor: "#fff7ed",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryBtnText: { color: "#ea580c", fontWeight: "600", fontSize: 14 },
  note: { fontSize: 13, color: "#6b7280", lineHeight: 19 },
  error: { color: "#dc2626", fontSize: 13 },
  success: { color: "#15803d", fontSize: 13 },
  signOut: { alignItems: "center", paddingVertical: 14 },
  signOutText: { color: "#dc2626", fontWeight: "600", fontSize: 15 },
});
