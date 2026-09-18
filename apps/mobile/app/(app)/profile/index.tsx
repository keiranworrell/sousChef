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
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { File, Paths, UploadType } from "expo-file-system";
import type { User } from "@souschef/shared";
import { getApiClient } from "../../../lib/api";
import {
  extensionForMime,
  mimeTypeForUpload,
  uploadSucceeded,
} from "../../../lib/upload";
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

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

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
        setAvatarUrl(res.data.avatarUrl);
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

  /**
   * Pick or photograph a picture, put it in S3, and hold the CDN URL.
   *
   * Nothing is saved to the profile here — the URL goes into local state and
   * is written by Save along with the name and bio. Uploading on pick and
   * saving on Save means a user who changes their mind and leaves has an
   * orphaned object in the bucket but an unchanged profile, which is the right
   * way round: the alternative is a picture that changes the instant you tap
   * it, with no way back short of picking another.
   */
  async function handlePickAvatar(source: "camera" | "library"): Promise<void> {
    setAvatarError(null);

    // Asked at the point of use, so the prompt arrives with its reason on
    // screen. Same reasoning as the recipe photo import.
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setAvatarError(
        source === "camera"
          ? "sousChef needs camera access to take a picture. You can turn it on in Settings."
          : "sousChef needs photo access to pick a picture. You can turn it on in Settings.",
      );
      return;
    }

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
            quality: 0.8,
            allowsEditing: true,
            aspect: [1, 1],
          })
        : await ImagePicker.launchImageLibraryAsync({
            quality: 0.8,
            allowsEditing: true,
            aspect: [1, 1],
            mediaTypes: ["images"],
          });

    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset?.uri) {
      setAvatarError("That image couldn't be read. Try another one.");
      return;
    }

    setAvatarBusy(true);
    // Declared out here so the finally block can tidy up whatever was made.
    let staged: File | null = null;
    try {
      const contentType = mimeTypeForUpload(asset.mimeType);

      const api = await getApiClient();
      const presign = await api.images.presign(contentType, "avatar");
      if ("error" in presign) throw new Error(presign.error.message);

      // Copied into the cache first. The picker's URI can be a content:// or
      // ph:// reference rather than a plain file, and File.upload wants
      // something it can read as a file — copying once is cheaper than
      // discovering which of those it was.
      staged = new File(Paths.cache, `avatar-upload.${extensionForMime(contentType)}`);
      if (staged.exists) staged.delete();
      // Awaited: copy() is the async form. copySync() exists and would block
      // the JS thread on a photo-sized file for no reason.
      await new File(asset.uri).copy(staged);

      const uploaded = await staged.upload(presign.data.uploadUrl, {
        httpMethod: "PUT",
        uploadType: UploadType.BINARY_CONTENT,
        // Must match the type the URL was signed for, or S3 refuses it.
        headers: { "Content-Type": contentType },
      });

      // Checked explicitly: File.upload resolves on a non-2xx response, so an
      // expired or mismatched presigned URL returns 403 as an ordinary
      // success. Without this we would save a CDN URL pointing at nothing.
      if (!uploadSucceeded(uploaded.status)) {
        throw new Error(`The upload was refused (${uploaded.status}).`);
      }

      setAvatarUrl(presign.data.imageUrl);
      setSaved(false);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Couldn't upload that picture");
    } finally {
      // The cache is the system's to clear, but leaving a copy of every avatar
      // anyone ever picked is untidy for no benefit.
      try { if (staged?.exists) staged.delete(); } catch { /* not worth reporting */ }
      setAvatarBusy(false);
    }
  }

  function chooseAvatarSource(): void {
    Alert.alert("Change your picture", undefined, [
      { text: "Take a photo", onPress: () => { void handlePickAvatar("camera"); } },
      { text: "Choose from library", onPress: () => { void handlePickAvatar("library"); } },
      ...(avatarUrl
        ? [{
            text: "Remove picture",
            style: "destructive" as const,
            onPress: () => { setAvatarUrl(null); setSaved(false); },
          }]
        : []),
      { text: "Cancel", style: "cancel" as const },
    ]);
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
        avatarUrl,
      });
      if ("error" in res) throw new Error(res.error.message);
      setUser(res.data);
      setAvatarUrl(res.data.avatarUrl);
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
          <TouchableOpacity
            onPress={chooseAvatarSource}
            disabled={avatarBusy}
            accessibilityLabel="Change your picture"
          >
            <Avatar displayName={displayName || user.displayName} avatarUrl={avatarUrl} size={64} />
            <View style={styles.avatarBadge}>
              {avatarBusy ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.avatarBadgeText}>Edit</Text>
              )}
            </View>
          </TouchableOpacity>
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

        {avatarError && <Text style={styles.error}>{avatarError}</Text>}

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
  avatarBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    minWidth: 38,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 8,
    backgroundColor: "#f97316",
    borderWidth: 2,
    borderColor: "#f9fafb",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
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
