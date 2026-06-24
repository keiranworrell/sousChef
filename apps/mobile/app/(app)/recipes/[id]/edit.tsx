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
  Switch,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { RecipeWithDetails, UpdateRecipeInput } from "@souschef/shared";
import { getApiClient } from "../../../../lib/api";

export default function EditRecipeScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingRecipe, setLoadingRecipe] = useState(true);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [servings, setServings] = useState("4");
  const [prepTime, setPrepTime] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [difficulty, setDifficulty] = useState<"" | "easy" | "medium" | "hard">("");
  const [cuisine, setCuisine] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const api = await getApiClient();
        const res = await api.recipes.get(id);
        if ("error" in res) throw new Error(res.error.message);
        const r: RecipeWithDetails = res.data;
        setTitle(r.title);
        setDescription(r.description ?? "");
        setServings(String(r.servings));
        setPrepTime(r.prepTimeMinutes != null ? String(r.prepTimeMinutes) : "");
        setCookTime(r.cookTimeMinutes != null ? String(r.cookTimeMinutes) : "");
        setDifficulty(r.difficulty ?? "");
        setCuisine(r.cuisine ?? "");
        setIsPublic(r.isPublic);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Failed to load recipe");
      } finally {
        setLoadingRecipe(false);
      }
    }
    void load();
  }, [id]);

  async function handleSave(): Promise<void> {
    if (!title.trim()) { setSaveError("Title is required"); return; }
    setSaveError(null);
    setSaving(true);
    try {
      const api = await getApiClient();
      const payload: UpdateRecipeInput = {
        title: title.trim(),
        description: description.trim() || null,
        servings: parseInt(servings, 10) || 4,
        prepTimeMinutes: prepTime ? parseInt(prepTime, 10) : null,
        cookTimeMinutes: cookTime ? parseInt(cookTime, 10) : null,
        difficulty: difficulty || null,
        cuisine: cuisine.trim() || null,
        isPublic,
      };
      const res = await api.recipes.update(id, payload);
      if ("error" in res) throw new Error(res.error.message);
      router.back();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  if (loadingRecipe) {
    return <View style={styles.center}><ActivityIndicator color="#f97316" /></View>;
  }

  if (loadError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{loadError}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={styles.backLink}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>← Back to recipe</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Edit recipe</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Title</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Recipe title" />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="Optional short description"
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Servings</Text>
            <TextInput style={styles.input} value={servings} onChangeText={setServings} keyboardType="number-pad" />
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Prep (min)</Text>
            <TextInput style={styles.input} value={prepTime} onChangeText={setPrepTime} keyboardType="number-pad" />
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Cook (min)</Text>
            <TextInput style={styles.input} value={cookTime} onChangeText={setCookTime} keyboardType="number-pad" />
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Difficulty</Text>
            <View style={styles.segmented}>
              {(["easy", "medium", "hard"] as const).map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.segment, difficulty === d && styles.segmentActive]}
                  onPress={() => setDifficulty(difficulty === d ? "" : d)}
                >
                  <Text style={[styles.segmentText, difficulty === d && styles.segmentTextActive]}>
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Cuisine</Text>
            <TextInput style={styles.input} value={cuisine} onChangeText={setCuisine} placeholder="e.g. Italian" />
          </View>
        </View>

        <View style={styles.switchRow}>
          <View>
            <Text style={styles.label}>Make public</Text>
            <Text style={styles.switchHint}>Others can find and fork this recipe</Text>
          </View>
          <Switch
            value={isPublic}
            onValueChange={setIsPublic}
            trackColor={{ false: "#d1d5db", true: "#fdba74" }}
            thumbColor={isPublic ? "#f97316" : "#fff"}
          />
        </View>

        {saveError && <Text style={styles.errorText}>{saveError}</Text>}

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.disabled]}
            onPress={() => { void handleSave(); }}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveButtonText}>Save changes</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f9fafb" },
  backLink: { fontSize: 14, color: "#f97316", marginBottom: 8 },
  pageTitle: { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 20 },
  field: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: "500", color: "#374151", marginBottom: 4 },
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
  row: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  segmented: { flexDirection: "row", borderRadius: 8, borderWidth: 1, borderColor: "#d1d5db", overflow: "hidden" },
  segment: { flex: 1, paddingVertical: 8, alignItems: "center", backgroundColor: "#fff" },
  segmentActive: { backgroundColor: "#f97316" },
  segmentText: { fontSize: 12, fontWeight: "500", color: "#374151" },
  segmentTextActive: { color: "#fff" },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  switchHint: { fontSize: 11, color: "#9ca3af", marginTop: 1 },
  errorText: { color: "#dc2626", fontSize: 13, marginBottom: 12 },
  footer: { gap: 10 },
  saveButton: { backgroundColor: "#f97316", borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  disabled: { opacity: 0.5 },
  saveButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  cancelButton: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  cancelButtonText: { color: "#374151", fontWeight: "600", fontSize: 15 },
});
