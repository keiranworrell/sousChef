import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { CreateRecipeInput } from "@souschef/shared";
import { getApiClient } from "../lib/api";
import { useTheme, useThemedStyles } from "./ThemeProvider";
import type { Palette } from "../lib/theme";

export type ImportMode = "manual" | "url" | "photo" | "text";

const MODES: Array<{ mode: ImportMode; label: string }> = [
  { mode: "manual", label: "Write it" },
  { mode: "url", label: "URL" },
  { mode: "photo", label: "Photo" },
  { mode: "text", label: "Paste" },
];

type Props = {
  mode: ImportMode;
  onModeChange: (mode: ImportMode) => void;
  /** A parsed recipe to review — photo and paste hand back a draft, not a save. */
  onDraft: (draft: CreateRecipeInput) => void;
  /** A URL import saves server-side, so it returns an id to navigate to. */
  onImported: (recipeId: string) => void;
  /** Null on premium, meaning no limit. Undefined while still loading. */
  aiImportsRemaining: number | null | undefined;
};

/**
 * The four ways to start a recipe, as tabs above the form.
 *
 * Photo and paste both go through an AI extraction that returns a draft rather
 * than saving. That draft fills the form in and the user reviews it before
 * anything is written — extraction from a photograph is a guess, and a guess
 * should not become a recipe someone relies on without being read first.
 *
 * A URL import is different: the server parses structured data, saves, and
 * returns the recipe. It is not a guess in the same way, and it already worked
 * that way before this screen existed.
 */
export default function ImportTabs({
  mode,
  onModeChange,
  onDraft,
  onImported,
  aiImportsRemaining,
}: Props): React.JSX.Element {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [url, setUrl] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const outOfCredits = aiImportsRemaining === 0;

  async function runUrlImport(): Promise<void> {
    const trimmed = url.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const api = await getApiClient();
      const res = await api.recipes.import({ url: trimmed });
      if ("error" in res) throw new Error(res.error.message);
      onImported(res.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't import that link");
    } finally {
      setBusy(false);
    }
  }

  async function runTextImport(): Promise<void> {
    const trimmed = pastedText.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const api = await getApiClient();
      const res = await api.recipes.importText({ text: trimmed });
      if ("error" in res) throw new Error(res.error.message);
      onDraft(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that text");
    } finally {
      setBusy(false);
    }
  }

  async function runPhotoImport(source: "camera" | "library"): Promise<void> {
    setError(null);

    // Asked at the point of use rather than on mount, so the prompt arrives
    // when the reason for it is on screen. A permission dialog that appears
    // before the user has asked for anything is the one people decline.
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError(
        source === "camera"
          ? "sousChef needs camera access to photograph a recipe. You can turn it on in Settings."
          : "sousChef needs photo access to read a recipe from your library. You can turn it on in Settings.",
      );
      return;
    }

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({
            base64: true,
            quality: 0.7,
            mediaTypes: ["images"],
          });

    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset?.base64) {
      setError("That image couldn't be read. Try another one.");
      return;
    }

    setBusy(true);
    try {
      const api = await getApiClient();
      const res = await api.recipes.importPhoto({
        images: [asset.base64],
        mimeTypes: [asset.mimeType ?? "image/jpeg"],
      });
      if ("error" in res) throw new Error(res.error.message);
      onDraft(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that photo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <View style={styles.tabs}>
        {MODES.map((m) => (
          <TouchableOpacity
            key={m.mode}
            onPress={() => { setError(null); onModeChange(m.mode); }}
            style={[styles.tab, mode === m.mode && styles.tabActive]}
          >
            <Text style={[styles.tabText, mode === m.mode && styles.tabTextActive]}>
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Only shown on the tabs that actually spend a credit, and only on a
          free plan. On premium the count is null and the line would be noise. */}
      {mode !== "manual" && mode !== "url" && aiImportsRemaining !== null && aiImportsRemaining !== undefined && (
        <Text style={outOfCredits ? styles.quotaSpent : styles.quota}>
          {outOfCredits
            ? "You've used all your free AI imports. Writing a recipe out by hand is always free."
            : `${aiImportsRemaining} free AI import${aiImportsRemaining === 1 ? "" : "s"} left`}
        </Text>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {mode === "url" && (
        <View style={styles.panel}>
          <TextInput
            style={styles.input}
            placeholder="https://example.com/recipe/..."
            placeholderTextColor={palette.textFaint}
            autoCapitalize="none"
            keyboardType="url"
            value={url}
            onChangeText={setUrl}
          />
          <PrimaryButton
            label="Import from link"
            busy={busy}
            disabled={!url.trim()}
            onPress={() => { void runUrlImport(); }}
          />
        </View>
      )}

      {mode === "photo" && (
        <View style={styles.panel}>
          <Text style={styles.hint}>
            Photograph a recipe from a book or card and we&apos;ll read it. You can
            check and change everything before saving.
          </Text>
          <View style={styles.row}>
            <PrimaryButton
              label="Take a photo"
              busy={busy}
              disabled={outOfCredits}
              onPress={() => { void runPhotoImport("camera"); }}
            />
            <SecondaryButton
              label="Choose one"
              disabled={busy || outOfCredits}
              onPress={() => { void runPhotoImport("library"); }}
            />
          </View>
        </View>
      )}

      {mode === "text" && (
        <View style={styles.panel}>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Paste a recipe here…"
            placeholderTextColor={palette.textFaint}
            multiline
            textAlignVertical="top"
            value={pastedText}
            onChangeText={setPastedText}
          />
          <PrimaryButton
            label="Read this"
            busy={busy}
            disabled={!pastedText.trim() || outOfCredits}
            onPress={() => { void runTextImport(); }}
          />
        </View>
      )}
    </View>
  );
}

function PrimaryButton({
  label,
  busy,
  disabled,
  onPress,
}: {
  label: string;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}): React.JSX.Element {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      style={[styles.button, (busy || disabled) && styles.buttonDisabled]}
      onPress={onPress}
      disabled={busy || disabled}
    >
      {busy ? <ActivityIndicator color={palette.onAccent} /> : <Text style={styles.buttonText}>{label}</Text>}
    </TouchableOpacity>
  );
}

function SecondaryButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}): React.JSX.Element {
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      style={[styles.secondary, disabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.secondaryText}>{label}</Text>
    </TouchableOpacity>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  tabs: {
    flexDirection: "row",
    backgroundColor: t.surfaceSunken,
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  tabActive: { backgroundColor: t.surface },
  tabText: { fontSize: 13, fontWeight: "600", color: t.textFaint },
  tabTextActive: { color: t.text },
  panel: { marginTop: 12, gap: 10 },
  row: { flexDirection: "row", gap: 10 },
  hint: { fontSize: 13, color: t.textMuted, lineHeight: 19 },
  quota: { marginTop: 10, fontSize: 12, color: t.textFaint },
  quotaSpent: { marginTop: 10, fontSize: 12, color: t.accentText, lineHeight: 18 },
  input: {
    borderWidth: 1,
    borderColor: t.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: t.text,
    backgroundColor: t.surface,
  },
  textArea: { minHeight: 140 },
  button: {
    flex: 1,
    backgroundColor: t.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: t.borderStrong,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: t.surface,
  },
  secondaryText: { color: t.textSecondary, fontWeight: "600", fontSize: 14 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: t.onAccent, fontWeight: "600", fontSize: 14 },
  error: { marginTop: 10, color: t.danger, fontSize: 13, lineHeight: 18 },
});
