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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TAB_BAR_ALLOWANCE } from "../../../../lib/tab-bar";
import type { IngredientField, StepField } from "../../../../lib/recipe-draft";
import { useTheme, useThemedStyles } from "../../../../components/ThemeProvider";
import type { Palette } from "../../../../lib/theme";

export default function EditRecipeScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
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
  // Editing these was impossible until now — not because the endpoint refused,
  // but because UpdateRecipeInput omitted them. The backend has always deleted
  // and reinserted both whenever they are present.
  const [ingredients, setIngredients] = useState<IngredientField[]>([]);
  const [steps, setSteps] = useState<StepField[]>([]);

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
        setIngredients(
          r.ingredients.length > 0
            ? r.ingredients.map((i) => ({
                name: i.name,
                quantity: i.quantity != null ? String(i.quantity) : "",
                unit: i.unit ?? "",
              }))
            : [{ name: "", quantity: "", unit: "" }],
        );
        setSteps(
          r.steps.length > 0
            ? r.steps.map((st) => ({
                instruction: st.instruction,
                timerSeconds: st.timerSeconds != null ? String(st.timerSeconds) : "",
              }))
            : [{ instruction: "", timerSeconds: "" }],
        );
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
        // Supplying these replaces the whole set rather than patching rows, so
        // empty ones are filtered out here — an untouched blank row at the
        // bottom of the form should not become a nameless ingredient.
        ingredients: ingredients
          .filter((i) => i.name.trim())
          .map((i, idx) => ({
            name: i.name.trim(),
            quantity: i.quantity ? parseFloat(i.quantity) : null,
            unit: i.unit.trim() || null,
            orderIndex: idx,
          })),
        steps: steps
          .filter((st) => st.instruction.trim())
          .map((st, idx) => ({
            stepNumber: idx + 1,
            instruction: st.instruction.trim(),
            timerSeconds: st.timerSeconds ? parseInt(st.timerSeconds, 10) : null,
          })),
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
    return <View style={styles.center}><ActivityIndicator color={palette.accent} /></View>;
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
      <ScrollView
        style={[styles.container, { paddingTop: insets.top }]}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + TAB_BAR_ALLOWANCE },
        ]}
      >
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
            trackColor={{ false: palette.borderStrong, true: palette.accentStrong }}
            thumbColor={isPublic ? palette.accent : palette.onAccent}
          />
        </View>

        <Text style={styles.groupHeading}>Ingredients</Text>
        {ingredients.map((ing, i) => (
          <View key={i} style={[styles.row, styles.field]}>
            <TextInput
              style={[styles.input, styles.grow]}
              placeholder="Ingredient"
              placeholderTextColor={palette.textFaint}
              value={ing.name}
              onChangeText={(v) =>
                setIngredients((prev) => prev.map((x, idx) => (idx === i ? { ...x, name: v } : x)))
              }
            />
            <TextInput
              style={[styles.input, styles.narrow]}
              placeholder="Qty"
              placeholderTextColor={palette.textFaint}
              keyboardType="decimal-pad"
              value={ing.quantity}
              onChangeText={(v) =>
                setIngredients((prev) => prev.map((x, idx) => (idx === i ? { ...x, quantity: v } : x)))
              }
            />
            <TextInput
              style={[styles.input, styles.narrow]}
              placeholder="Unit"
              placeholderTextColor={palette.textFaint}
              value={ing.unit}
              onChangeText={(v) =>
                setIngredients((prev) => prev.map((x, idx) => (idx === i ? { ...x, unit: v } : x)))
              }
            />
            <TouchableOpacity
              onPress={() => setIngredients((prev) => prev.filter((_, idx) => idx !== i))}
              accessibilityLabel={`Remove ingredient ${i + 1}`}
            >
              <Text style={styles.removeText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity
          onPress={() => setIngredients((prev) => [...prev, { name: "", quantity: "", unit: "" }])}
        >
          <Text style={styles.addText}>+ Add ingredient</Text>
        </TouchableOpacity>

        <Text style={styles.groupHeading}>Steps</Text>
        {steps.map((st, i) => (
          <View key={i} style={styles.field}>
            <View style={styles.row}>
              <Text style={styles.stepNumber}>{i + 1}</Text>
              <TextInput
                style={[styles.input, styles.multiline, styles.grow]}
                placeholder="What happens at this step?"
                placeholderTextColor={palette.textFaint}
                multiline
                value={st.instruction}
                onChangeText={(v) =>
                  setSteps((prev) => prev.map((x, idx) => (idx === i ? { ...x, instruction: v } : x)))
                }
              />
              <TouchableOpacity
                onPress={() => setSteps((prev) => prev.filter((_, idx) => idx !== i))}
                accessibilityLabel={`Remove step ${i + 1}`}
              >
                <Text style={styles.removeText}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, styles.timer]}
              placeholder="Timer (seconds, optional)"
              placeholderTextColor={palette.textFaint}
              keyboardType="number-pad"
              value={st.timerSeconds}
              onChangeText={(v) =>
                setSteps((prev) => prev.map((x, idx) => (idx === i ? { ...x, timerSeconds: v } : x)))
              }
            />
          </View>
        ))}
        <TouchableOpacity
          onPress={() => setSteps((prev) => [...prev, { instruction: "", timerSeconds: "" }])}
        >
          <Text style={styles.addText}>+ Add step</Text>
        </TouchableOpacity>

        {saveError && <Text style={styles.errorText}>{saveError}</Text>}

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.disabled]}
            onPress={() => { void handleSave(); }}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={palette.onAccent} />
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

const makeStyles = (t: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  content: { padding: 16 },
  groupHeading: {
    fontSize: 12,
    fontWeight: "700",
    color: t.textFaint,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 18,
    marginBottom: 10,
  },
  grow: { flex: 1 },
  narrow: { width: 64 },
  timer: { marginTop: 8, marginLeft: 26 },
  stepNumber: { width: 18, paddingTop: 10, fontSize: 13, fontWeight: "600", color: t.textFaint },
  removeText: { paddingTop: 8, paddingHorizontal: 4, fontSize: 16, color: t.textFaint },
  addText: { fontSize: 13, fontWeight: "600", color: t.accent, paddingVertical: 6 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.bg },
  backLink: { fontSize: 14, color: t.accent, marginBottom: 8 },
  pageTitle: { fontSize: 22, fontWeight: "700", color: t.text, marginBottom: 20 },
  field: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: "500", color: t.textSecondary, marginBottom: 4 },
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
  multiline: { minHeight: 72, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  segmented: { flexDirection: "row", borderRadius: 8, borderWidth: 1, borderColor: t.borderStrong, overflow: "hidden" },
  segment: { flex: 1, paddingVertical: 8, alignItems: "center", backgroundColor: t.surface },
  segmentActive: { backgroundColor: t.accent },
  segmentText: { fontSize: 12, fontWeight: "500", color: t.textSecondary },
  segmentTextActive: { color: t.onAccent },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  switchHint: { fontSize: 11, color: t.textFaint, marginTop: 1 },
  errorText: { color: t.danger, fontSize: 13, marginBottom: 12 },
  footer: { gap: 10 },
  saveButton: { backgroundColor: t.accent, borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  disabled: { opacity: 0.5 },
  saveButtonText: { color: t.onAccent, fontWeight: "600", fontSize: 15 },
  cancelButton: { borderWidth: 1, borderColor: t.borderStrong, borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  cancelButtonText: { color: t.textSecondary, fontWeight: "600", fontSize: 15 },
});
