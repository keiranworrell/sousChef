import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { User } from "@souschef/shared";
import { getApiClient } from "../../../lib/api";
import Avatar from "../../../components/Avatar";
import UserListSheet, { type UserListKind } from "../../../components/UserListSheet";

export default function ProfileScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [preferences, setPreferences] = useState<string[]>([]);
  const [prefInput, setPrefInput] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [panel, setPanel] = useState<UserListKind | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const api = await getApiClient();
        const res = await api.users.me();
        if ("error" in res) throw new Error(res.error.message);
        setUser(res.data);
        setDisplayName(res.data.displayName);
        setBio(res.data.bio ?? "");
        setPreferences(res.data.dietaryPreferences ?? []);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Couldn't load your profile");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  function addPreference(): void {
    const value = prefInput.trim();
    // Case-insensitive, because "Vegan" and "vegan" are the same preference and
    // a list holding both looks like a bug to the person who typed them.
    if (!value || preferences.some((p) => p.toLowerCase() === value.toLowerCase())) {
      setPrefInput("");
      return;
    }
    setPreferences((prev) => [...prev, value]);
    setPrefInput("");
  }

  async function handleSave(): Promise<void> {
    const name = displayName.trim();
    if (!name) {
      setSaveError("Your name can't be empty.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const api = await getApiClient();
      const res = await api.users.update({
        displayName: name,
        bio: bio.trim() || null,
        dietaryPreferences: preferences,
      });
      if ("error" in res) throw new Error(res.error.message);
      setUser(res.data);
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't save that");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f97316" />
      </View>
    );
  }

  if (loadError || !user) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{loadError ?? "Profile not found"}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.identity}>
          <Avatar displayName={user.displayName} avatarUrl={user.avatarUrl} size={64} />
          <View style={styles.counts}>
            <TouchableOpacity style={styles.count} onPress={() => setPanel("followers")}>
              <Text style={styles.countValue}>{user.followerCount}</Text>
              <Text style={styles.countLabel}>
                {user.followerCount === 1 ? "follower" : "followers"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.count} onPress={() => setPanel("following")}>
              <Text style={styles.countValue}>{user.followingCount}</Text>
              <Text style={styles.countLabel}>following</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Deliberate, not an oversight. Uploading to a presigned S3 URL from
            React Native needs a different body than the browser's File, and
            that path is untestable without a device — so it is named here
            rather than shipped on a guess. Everything else on this screen is
            editable. */}
        <Text style={styles.avatarNote}>
          Changing your picture is on the website for now.
        </Text>

        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={(v) => { setDisplayName(v); setSaved(false); }}
          maxLength={80}
          placeholder="Your name"
          placeholderTextColor="#9ca3af"
        />

        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={bio}
          onChangeText={(v) => { setBio(v); setSaved(false); }}
          maxLength={500}
          multiline
          placeholder="What you like to cook"
          placeholderTextColor="#9ca3af"
        />

        <Text style={styles.label}>Dietary preferences</Text>
        {preferences.length > 0 && (
          <View style={styles.chips}>
            {preferences.map((pref) => (
              <TouchableOpacity
                key={pref}
                style={styles.chip}
                onPress={() => {
                  setPreferences((prev) => prev.filter((p) => p !== pref));
                  setSaved(false);
                }}
                accessibilityLabel={`Remove ${pref}`}
              >
                <Text style={styles.chipText}>{pref} ✕</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <View style={styles.prefRow}>
          <TextInput
            style={[styles.input, styles.prefInput]}
            value={prefInput}
            onChangeText={setPrefInput}
            placeholder="Vegetarian, gluten-free…"
            placeholderTextColor="#9ca3af"
            maxLength={40}
            onSubmitEditing={addPreference}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.addPref, !prefInput.trim() && styles.disabled]}
            onPress={addPreference}
            disabled={!prefInput.trim()}
          >
            <Text style={styles.addPrefText}>Add</Text>
          </TouchableOpacity>
        </View>

        {saveError && <Text style={styles.error}>{saveError}</Text>}
        {saved && <Text style={styles.saved}>Saved.</Text>}

        <TouchableOpacity
          style={[styles.primary, saving && styles.disabled]}
          onPress={() => { void handleSave(); }}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save profile</Text>}
        </TouchableOpacity>
      </ScrollView>

      <UserListSheet
        target={panel ? { userId: user.id, kind: panel } : null}
        ownUserId={user.id}
        onClose={() => setPanel(null)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f9fafb" },
  body: { padding: 16, paddingBottom: 48, gap: 8 },
  identity: { flexDirection: "row", alignItems: "center", gap: 20, marginBottom: 4 },
  counts: { flexDirection: "row", gap: 24 },
  count: { alignItems: "center" },
  countValue: { fontSize: 18, fontWeight: "700", color: "#111827" },
  countLabel: { fontSize: 12, color: "#9ca3af" },
  avatarNote: { fontSize: 12, color: "#9ca3af", marginBottom: 8 },
  label: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: "700",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#fff",
  },
  multiline: { minHeight: 84, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
  chip: {
    backgroundColor: "#fff7ed",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: { fontSize: 12, fontWeight: "600", color: "#ea580c" },
  prefRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  prefInput: { flex: 1 },
  addPref: { backgroundColor: "#f97316", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 11 },
  addPrefText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  primary: {
    marginTop: 16,
    backgroundColor: "#f97316",
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  disabled: { opacity: 0.5 },
  error: { color: "#dc2626", fontSize: 13, marginTop: 6 },
  saved: { color: "#059669", fontSize: 13, fontWeight: "600", marginTop: 6 },
});
